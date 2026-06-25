/**
 * POST /api/pipeline/process
 *
 * Internal pipeline worker. Processes a single artwork:
 *   0. Converts original image to inscription-optimised JPEG (sets jpeg_storage_path)
 *   1. Creates a Printify product and publishes it to Shopify
 *   2. Inscribes the image as a BSV 1Sat Ordinal
 *
 * Protected by PIPELINE_WEBHOOK_SECRET header (same secret as /api/pipeline/trigger).
 * Called by /api/pipeline/trigger when no external PIPELINE_WEBHOOK_URL is configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createAdminClient } from '@/lib/supabase/admin'
import { inscribeWithRetry } from '@/lib/bsv/inscribe'
import {
  uploadImageByBase64,
  createProduct,
  publishProduct,
  getProduct,
  getBlueprintVariants,
} from '@/lib/printify/client'

export const runtime = 'nodejs'
export const maxDuration = 60

const JPEG_MAX_BYTES = 400 * 1024 // 400 KB — ordinal inscription size limit

export async function POST(req: NextRequest) {
  const secret = process.env.PIPELINE_WEBHOOK_SECRET
  if (secret && req.headers.get('x-pipeline-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let artworkId: string | undefined
  try {
    const body = await req.json()
    artworkId = body.artworkId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!artworkId) {
    return NextResponse.json({ error: 'artworkId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load artwork
  const { data: artwork, error: artErr } = await admin
    .from('artwork')
    .select('id, title, storage_path, jpeg_storage_path, artist_id, status')
    .eq('id', artworkId)
    .single()

  if (artErr || !artwork) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  if (!artwork.storage_path) {
    return NextResponse.json({ error: 'Artwork has no storage_path' }, { status: 422 })
  }

  // Mark as processing
  await admin.from('artwork').update({ status: 'processing' }).eq('id', artworkId)

  const results: { jpeg?: string; printify?: string; bsv?: string; errors: string[] } = { errors: [] }

  // ── Step 0: JPEG prep ──────────────────────────────────────────────────────────
  // Convert original to inscription-optimised JPEG so it appears on the ordinals
  // marketplace for collector minting. Idempotent — skipped if already done.

  let imageBuffer: Buffer | null = null // reuse across steps

  if (!artwork.jpeg_storage_path) {
    try {
      const { data: fileData, error: dlErr } = await admin.storage
        .from('artwork-originals')
        .download(artwork.storage_path)

      if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message ?? 'unknown'}`)

      const ab = await fileData.arrayBuffer()
      imageBuffer = Buffer.from(ab)

      let quality = 85
      let jpegBuffer: Buffer
      do {
        jpegBuffer = await sharp(imageBuffer)
          .jpeg({ quality, mozjpeg: true })
          .toBuffer()
        quality -= 5
      } while (jpegBuffer.length > JPEG_MAX_BYTES && quality >= 50)

      const jpegPath = (artwork.storage_path as string).replace(/\.[^.]+$/, '.jpg')
      const { error: uploadErr } = await admin.storage
        .from('artwork-originals')
        .upload(jpegPath, jpegBuffer, { contentType: 'image/jpeg', upsert: true })

      if (uploadErr) throw new Error(`JPEG upload failed: ${uploadErr.message}`)

      await admin.from('artwork').update({ jpeg_storage_path: jpegPath }).eq('id', artworkId)
      results.jpeg = jpegPath
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`JPEG prep: ${msg}`)
      console.error(`[pipeline] JPEG prep failed for ${artworkId}:`, msg)
      // Non-fatal — continue with rest of pipeline
    }
  } else {
    results.jpeg = artwork.jpeg_storage_path as string
  }

  // ── Step 1: Printify ─────────────────────────────────────────────────────────

  const printifyToken = process.env.PRINTIFY_API_TOKEN
  const blueprintId = parseInt(process.env.PRINTIFY_BLUEPRINT_ID ?? '5', 10)
  const printProviderId = parseInt(process.env.PRINTIFY_PRINT_PROVIDER_ID ?? '99', 10)

  if (printifyToken) {
    try {
      await admin.from('artwork').update({ status: 'shop_pending' }).eq('id', artworkId)

      // Download original from Supabase storage
      const { data: fileData, error: dlErr } = await admin.storage
        .from('artwork-originals')
        .download(artwork.storage_path)

      if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)

      const arrayBuffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const filename = artwork.storage_path.split('/').pop() ?? 'artwork.jpg'

      // Upload to Printify
      const printifyImageId = await uploadImageByBase64(base64, filename)

      // Update artwork with Printify image ID
      await admin.from('artwork').update({ printify_image_id: printifyImageId }).eq('id', artworkId)

      // Get blueprint variants (use all enabled by default)
      const allVariants = await getBlueprintVariants(blueprintId, printProviderId)
      const variants = allVariants.slice(0, 10).map((v) => ({
        id: v.id,
        price: 3999, // $39.99 base — artist can adjust
        is_enabled: true,
      }))

      // Create Printify product
      const product = await createProduct({
        title: artwork.title ?? 'Untitled',
        description: `Original artwork by ASMRtists artist.`,
        printifyImageId,
        blueprintId,
        printProviderId,
        variants,
      })

      // Save product ID to print_products table
      await admin.from('print_products').upsert(
        {
          artwork_id: artworkId,
          product_type: 'poster',
          printify_product_id: product.id,
          printify_image_id: printifyImageId,
        },
        { onConflict: 'artwork_id,product_type' },
      )

      // Publish to Shopify
      await publishProduct(product.id)

      // Fetch the Shopify handle from Printify after publishing
      try {
        const published = await getProduct(product.id)
        const shopifyHandle = published.external?.handle
        if (shopifyHandle) {
          await admin.from('print_products').update({ shopify_product_handle: shopifyHandle }).eq('printify_product_id', product.id)
        }
      } catch {
        // Non-fatal — handle can be backfilled later
      }

      await admin.from('artwork').update({ status: 'shop_ready' }).eq('id', artworkId)
      results.printify = product.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`Printify: ${msg}`)
      await admin
        .from('artwork')
        .update({ status: 'error', error_message: `Printify failed: ${msg}` })
        .eq('id', artworkId)
    }
  } else {
    results.errors.push('Printify: PRINTIFY_API_TOKEN not set — skipped')
  }

  // ── Step 2: BSV ordinal inscription ──────────────────────────────────────────

  const fundingWif = process.env.PLATFORM_FUNDING_WIF

  if (fundingWif) {
    try {
      // Get artist's BSV wallet address
      const { data: ap } = await admin
        .from('artist_profiles')
        .select('user_id')
        .eq('id', artwork.artist_id)
        .single()

      const { data: walletRows } = ap
        ? await admin.from('wallets').select('address, label').eq('user_id', ap.user_id).in('label', ['Ordinals', 'Primary'])
        : { data: null }

      // Prefer ordinals-specific address; fall back to pay address
      const wallet = walletRows?.find(w => w.label === 'Ordinals') ?? walletRows?.find(w => w.label === 'Primary') ?? null

      if (!wallet?.address) {
        results.errors.push('BSV: artist wallet address not found — skipped')
      } else {
        await admin.from('artwork').update({ status: 'minting' }).eq('id', artworkId)

        // Prefer the JPEG-optimised version (≤400 KB) for the inscription.
      // Fall back to the original only if JPEG conversion never ran.
        const inscribePath = (artwork.jpeg_storage_path as string | null) ?? artwork.storage_path
        const { data: fileData, error: dlErr } = await admin.storage
          .from('artwork-originals')
          .download(inscribePath)

        if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)

        const buffer = Buffer.from(await fileData.arrayBuffer())

        const inscribeResult = await inscribeWithRetry({
          jpegData: buffer,
          recipientAddress: wallet.address,
          metadata: {
            app: 'ASMRtists',
            type: 'ord',
            artworkId: String(artworkId),
            contentType: 'image/jpeg',
          },
        })

        await admin
          .from('artwork')
          .update({
            status: 'minted',
            inscription_txid: inscribeResult.txid,
            inscription_outpoint: inscribeResult.outpoint,
          })
          .eq('id', artworkId)

        results.bsv = inscribeResult.txid
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.errors.push(`BSV: ${msg}`)
      await admin
        .from('artwork')
        .update({ status: 'mint_error', error_message: `Inscription failed: ${msg}` })
        .eq('id', artworkId)
    }
  } else {
    results.errors.push('BSV: PLATFORM_FUNDING_WIF not set — skipped')
  }

  return NextResponse.json({
    artworkId,
    ...results,
    ok: results.errors.length === 0,
  })
}
