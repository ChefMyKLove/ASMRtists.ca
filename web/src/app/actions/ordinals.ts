'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import sharp from 'sharp'
import { inscribeWithRetry } from '@/lib/bsv/inscribe'
import { verifyOwnership } from '@/lib/bsv/auth'

const JPEG_MAX_BYTES = 400 * 1024 // 400 KB

/**
 * Convert an artwork's original PNG to an inscription-optimised JPEG
 * and store it in the `artwork-jpegs` Supabase Storage bucket.
 *
 * Called by the artist dashboard "Prepare for Minting" button.
 * Idempotent — re-running when jpeg_storage_path is already set is a no-op.
 */
export async function prepareOrdinalAction(
  artworkId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()

  // Verify the caller is the owning artist
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) return { ok: false, error: 'No artist profile found' }

  const { data: art } = await admin
    .from('artwork')
    .select('id, storage_path, jpeg_storage_path')
    .eq('id', artworkId)
    .eq('artist_id', ap.id)
    .single()
  if (!art) return { ok: false, error: 'Artwork not found or access denied' }

  // Idempotent — already prepared
  if (art.jpeg_storage_path) return { ok: true }

  if (!art.storage_path) return { ok: false, error: 'No source image on record' }

  // Download original PNG from Supabase Storage
  const { data: fileData, error: dlErr } = await admin.storage
    .from('artwork-originals')
    .download(art.storage_path)
  if (dlErr || !fileData) {
    return { ok: false, error: `Download failed: ${dlErr?.message ?? 'unknown'}` }
  }

  // Convert PNG → JPEG, stepping quality down until under JPEG_MAX_BYTES
  const arrayBuffer = await fileData.arrayBuffer()
  let quality = 85
  let jpegBuffer: Buffer
  do {
    jpegBuffer = await sharp(Buffer.from(arrayBuffer))
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    quality -= 5
  } while (jpegBuffer.length > JPEG_MAX_BYTES && quality >= 50)

  // Upload to artwork-jpegs bucket (path mirrors the original, .jpg extension)
  const jpegPath = art.storage_path.replace(/\.[^.]+$/, '.jpg')
  const { error: uploadErr } = await admin.storage
    .from('artwork-originals')
    .upload(jpegPath, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (uploadErr) {
    return { ok: false, error: `Upload failed: ${uploadErr.message}` }
  }

  // Persist jpeg_storage_path
  const { error: dbErr } = await admin
    .from('artwork')
    .update({ jpeg_storage_path: jpegPath })
    .eq('id', artworkId)
  if (dbErr) {
    return { ok: false, error: `DB update failed: ${dbErr.message}` }
  }

  return { ok: true }
}

// ─── Mint ordinal for a collector ────────────────────────────────────────────

/**
 * Inscribe a prepared artwork as a 1Sat Ordinal and deliver it to the
 * collector's ordinal address. Called from the public Ordinals Marketplace.
 *
 * No payment verification yet — MNEE payment needs to be wired separately.
 */
export async function mintOrdinalAction(
  artworkId: string,
  recipientOrdAddress: string,
): Promise<{ ok: boolean; txid?: string; outpoint?: string; error?: string }> {
  if (!artworkId || !recipientOrdAddress) {
    return { ok: false, error: 'artworkId and recipientOrdAddress are required' }
  }

  const admin = createAdminClient()

  // Load artwork — verify it's mintable
  const { data: art } = await admin
    .from('artwork')
    .select('id, jpeg_storage_path, inscription_txid, collection_id')
    .eq('id', artworkId)
    .single()

  if (!art) return { ok: false, error: 'Artwork not found' }
  if (art.inscription_txid) return { ok: false, error: 'Already minted' }
  if (!art.jpeg_storage_path) return { ok: false, error: 'JPEG not prepared — run ordinal prep first' }

  // Verify collection is council-approved (status = 'active')
  const { data: col } = await admin
    .from('collections')
    .select('status')
    .eq('id', art.collection_id)
    .single()

  if (!col || col.status !== 'active') {
    return { ok: false, error: 'Collection not approved for minting' }
  }

  // Download JPEG
  const { data: fileData, error: dlErr } = await admin.storage
    .from('artwork-originals')
    .download(art.jpeg_storage_path)

  if (dlErr || !fileData) {
    return { ok: false, error: `Storage download failed: ${dlErr?.message ?? 'unknown'}` }
  }

  const jpegBuffer = Buffer.from(await fileData.arrayBuffer())

  // Mark as minting (idempotency guard)
  await admin.from('artwork').update({ status: 'minting' }).eq('id', artworkId)

  try {
    const result = await inscribeWithRetry({
      jpegData: jpegBuffer,
      recipientAddress: recipientOrdAddress,
      metadata: { app: 'ASMRtists', type: 'ord', artworkId },
    })

    await admin
      .from('artwork')
      .update({
        status: 'minted',
        inscription_txid: result.txid,
        inscription_outpoint: result.outpoint,
      })
      .eq('id', artworkId)

    return { ok: true, txid: result.txid, outpoint: result.outpoint }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin.from('artwork').update({ status: 'mint_error' }).eq('id', artworkId)
    return { ok: false, error: message }
  }
}

// ─── Create resale listing ────────────────────────────────────────────────────

/**
 * Create a resale listing for a minted ordinal.
 * Verifies on-chain ownership via 1sat.app before inserting.
 */
export async function createListingAction(
  inscriptionOutpoint: string,
  priceMnee: number,
  sellerOrdAddress: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!inscriptionOutpoint || !priceMnee || !sellerOrdAddress) {
    return { ok: false, error: 'All fields are required' }
  }
  if (priceMnee <= 0) return { ok: false, error: 'Price must be greater than 0' }

  // Verify the caller actually holds this ordinal
  const isOwner = await verifyOwnership(inscriptionOutpoint, sellerOrdAddress)
  if (!isOwner) {
    return { ok: false, error: 'Ownership verification failed — are you sure you hold this ordinal?' }
  }

  const admin = createAdminClient()

  // Find the artwork in our system
  const { data: art } = await admin
    .from('artwork')
    .select('id')
    .eq('inscription_outpoint', inscriptionOutpoint)
    .maybeSingle()

  if (!art) {
    return { ok: false, error: 'Ordinal not found in the ASMRtists catalog' }
  }

  // Check for duplicate active listing
  const { data: existing } = await admin
    .from('ordinal_listings')
    .select('id')
    .eq('inscription_outpoint', inscriptionOutpoint)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    return { ok: false, error: 'An active listing already exists for this ordinal' }
  }

  const { error: insertErr } = await admin.from('ordinal_listings').insert({
    artwork_id: art.id,
    inscription_outpoint: inscriptionOutpoint,
    seller_ord_address: sellerOrdAddress,
    price_mnee: priceMnee,
    status: 'active',
  })

  if (insertErr) return { ok: false, error: insertErr.message }
  return { ok: true }
}
