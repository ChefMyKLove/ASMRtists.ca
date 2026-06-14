/**
 * POST /api/pipeline/process
 *
 * Internal pipeline worker. Processes a single artwork:
 *   1. Creates a Printify product and publishes it to Shopify
 *   2. Inscribes the image as a BSV 1Sat Ordinal
 *
 * Protected by PIPELINE_WEBHOOK_SECRET header (same secret as /api/pipeline/trigger).
 * Called by /api/pipeline/trigger when no external PIPELINE_WEBHOOK_URL is configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inscribeWithRetry } from '@/lib/bsv/inscribe'
import {
  uploadImageByBase64,
  createProduct,
  publishProduct,
  getBlueprintVariants,
} from '@/lib/printify/client'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    .select('id, title, storage_path, artist_id, status')
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

  const results: { printify?: string; bsv?: string; errors: string[] } = { errors: [] }

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

      const { data: wallet } = ap
        ? await admin.from('wallets').select('address').eq('user_id', ap.user_id).maybeSingle()
        : { data: null }

      if (!wallet?.address) {
        results.errors.push('BSV: artist wallet address not found — skipped')
      } else {
        await admin.from('artwork').update({ status: 'minting' }).eq('id', artworkId)

        // Download from storage (may already be in memory from Printify step, but keep separate)
        const { data: fileData, error: dlErr } = await admin.storage
          .from('artwork-originals')
          .download(artwork.storage_path)

        if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)

        const buffer = Buffer.from(await fileData.arrayBuffer())

        // Determine content type
        const filename = artwork.storage_path.toLowerCase()
        const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg'

        const inscribeResult = await inscribeWithRetry({
          jpegData: buffer,
          recipientAddress: wallet.address,
          metadata: {
            app: 'ASMRtists',
            type: 'ord',
            artworkId: String(artworkId),
            contentType,
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
