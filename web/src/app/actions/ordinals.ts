'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import sharp from 'sharp'
import { inscribeWithRetry } from '@/lib/bsv/inscribe'
import { verifyOwnership } from '@/lib/bsv/auth'
import { deliverOrdinalFromEscrow, getPlatformEscrowAddress, verifyPaymentSplit } from '@/lib/bsv/marketplace'

// ─── Revenue split constants ──────────────────────────────────────────────────
// Applied on ALL ordinal sales (initial + resale) through the platform escrow.
// Royalties are enforced at delivery time — no BSV protocol support required.
export const SELLER_SHARE  = 0.75  // artist on primary sale, collector on resale
export const CURATOR_SHARE = 0.15  // routes to CURATOR_TREASURY_ADDRESS
export const PLATFORM_SHARE = 0.10 // routes to platform funding wallet

const JPEG_MAX_BYTES = 400 * 1024 // 400 KB

// ─── Escrow UTXO health check ─────────────────────────────────────────────────

const VERIFY_CACHE_MS = 5 * 60 * 1000 // skip re-check if verified within last 5 min

/**
 * Ask 1sat.app whether the escrow UTXO (vout 0 of the given txid) has been spent.
 * Returns 'valid' (unspent), 'spent' (consumed), or 'unknown' (API unreachable).
 */
async function checkEscrowUtxo(escrowTxid: string): Promise<'valid' | 'spent' | 'unknown'> {
  try {
    const res = await fetch(`https://api.1sat.app/1sat/txo/${escrowTxid}.0`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return 'unknown'
    const txo = await res.json() as Record<string, unknown>
    return txo.spend ? 'spent' : 'valid'
  } catch {
    return 'unknown'
  }
}

// ─── Validate a listing's escrow UTXO ────────────────────────────────────────

/**
 * Check whether an active listing's escrow UTXO is still unspent on-chain.
 * If the UTXO has been consumed outside the normal delivery flow, marks the
 * listing as 'delisted_transferred' and returns { valid: false, stale: true }.
 *
 * Results are cached via last_verified_at — calls within 5 minutes short-circuit.
 */
export async function validateListingAction(
  listingId: string,
): Promise<{ valid: boolean; stale?: boolean; error?: string }> {
  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('ordinal_listings')
    .select('id, escrow_txid, status, last_verified_at')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) return { valid: false, error: 'Listing not found' }
  if (listing.status === 'delisted_transferred') return { valid: false, stale: true }
  if (listing.status !== 'active') return { valid: false, error: 'Listing is not active' }
  if (!listing.escrow_txid) return { valid: true } // pending_escrow — no UTXO to check

  // Short-circuit if recently verified
  if (listing.last_verified_at) {
    const age = Date.now() - new Date(listing.last_verified_at as string).getTime()
    if (age < VERIFY_CACHE_MS) return { valid: true }
  }

  const utxoStatus = await checkEscrowUtxo(listing.escrow_txid as string)

  if (utxoStatus === 'spent') {
    await admin
      .from('ordinal_listings')
      .update({ status: 'delisted_transferred', updated_at: new Date().toISOString() })
      .eq('id', listingId)
      .eq('status', 'active') // guard against concurrent delists
    return { valid: false, stale: true }
  }

  if (utxoStatus === 'valid') {
    await admin
      .from('ordinal_listings')
      .update({ last_verified_at: new Date().toISOString() })
      .eq('id', listingId)
  }

  return { valid: true } // 'unknown' = fail-open; buyer will get a clear error if delivery fails
}

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
  sellerBsvAddress?: string,
): Promise<{ ok: boolean; listingId?: string; escrowAddress?: string; error?: string }> {
  if (!inscriptionOutpoint || !priceMnee || !sellerOrdAddress) {
    return { ok: false, error: 'All fields are required' }
  }
  if (priceMnee <= 0) return { ok: false, error: 'Price must be greater than 0' }

  // Try ordAddress first, then bsvAddress as fallback — the ordinal may live at either
  // depending on which address was active when it was minted.
  const uniqueCandidates = [...new Set([sellerOrdAddress, ...(sellerBsvAddress ? [sellerBsvAddress] : [])])]

  let confirmedAddress: string | null = null
  for (const addr of uniqueCandidates) {
    if (await verifyOwnership(inscriptionOutpoint, addr)) {
      confirmedAddress = addr
      break
    }
  }

  if (!confirmedAddress) {
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

  let escrowAddress: string
  try {
    escrowAddress = getPlatformEscrowAddress()
  } catch {
    return { ok: false, error: 'Platform escrow is not configured' }
  }

  const { data: inserted, error: insertErr } = await admin.from('ordinal_listings').insert({
    artwork_id: art.id,
    inscription_outpoint: inscriptionOutpoint,
    seller_ord_address: confirmedAddress,
    price_mnee: priceMnee,
    status: 'pending_escrow',
  }).select('id').single()

  if (insertErr || !inserted) return { ok: false, error: insertErr?.message ?? 'Insert failed' }
  return { ok: true, listingId: inserted.id, escrowAddress }
}

// ─── Cancel listing ──────────────────────────────────────────────────────────

/**
 * Cancel an active or pending-escrow listing.
 * - pending_escrow: ordinal never left seller's wallet; just mark cancelled in DB.
 * - active: ordinal is in platform escrow; return it to the seller, then cancel.
 */
export async function cancelListingAction(
  listingId: string,
  sellerOrdAddress: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!listingId || !sellerOrdAddress) {
    return { ok: false, error: 'listingId and sellerOrdAddress are required' }
  }

  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('ordinal_listings')
    .select('id, status, escrow_txid, seller_ord_address')
    .eq('id', listingId)
    .eq('seller_ord_address', sellerOrdAddress)
    .maybeSingle()

  if (!listing) return { ok: false, error: 'Listing not found or access denied' }
  if (!['active', 'pending_escrow'].includes(listing.status as string)) {
    return { ok: false, error: 'Listing cannot be cancelled' }
  }

  if (listing.status === 'active' && listing.escrow_txid) {
    // Protect other active escrow UTXOs from being consumed as fees
    const { data: others } = await admin
      .from('ordinal_listings')
      .select('escrow_txid')
      .eq('status', 'active')
      .neq('id', listingId)
      .not('escrow_txid', 'is', null)

    const otherEscrowTxids = (others ?? [])
      .map((l) => l.escrow_txid as string)
      .filter(Boolean)

    try {
      await deliverOrdinalFromEscrow(listing.escrow_txid, sellerOrdAddress, otherEscrowTxids)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to return ordinal from escrow' }
    }
  }

  const { error } = await admin
    .from('ordinal_listings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', listingId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Confirm escrow ───────────────────────────────────────────────────────────

/**
 * Called by the client after the seller's wallet has successfully sent the
 * ordinal to the platform escrow address. Stores the escrow txid and marks
 * the listing as active so it appears in the marketplace.
 */
export async function confirmListingEscrow(
  listingId: string,
  escrowTxid: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!listingId || !escrowTxid) return { ok: false, error: 'listingId and escrowTxid are required' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('ordinal_listings')
    .update({
      escrow_txid: escrowTxid,
      listed_outpoint: `${escrowTxid}_0`,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .eq('status', 'pending_escrow')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Payment split lookup ─────────────────────────────────────────────────────

/**
 * Return the exact BSV outputs the buyer's wallet must include in their payment tx.
 * The client calls this before `sendBsv` so it can build the correct multi-output tx.
 */
export async function getListingSplitAction(listingId: string): Promise<{
  ok: boolean
  sellerAddress?: string
  platformAddress?: string
  curatorAddress?: string
  sellerSats?: number
  platformSats?: number
  curatorSats?: number
  totalSats?: number
  error?: string
}> {
  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('ordinal_listings')
    .select('id, price_mnee, seller_ord_address, status')
    .eq('id', listingId)
    .eq('status', 'active')
    .maybeSingle()

  if (!listing) return { ok: false, error: 'Listing not found or not active' }

  let platformAddress: string
  try {
    platformAddress = getPlatformEscrowAddress()
  } catch {
    return { ok: false, error: 'Platform not configured for payments' }
  }

  // Curator treasury — separate env var so payouts can be routed independently.
  // Falls back to the platform address until a dedicated curator wallet is set.
  const curatorAddress = process.env.CURATOR_TREASURY_ADDRESS ?? platformAddress

  const totalSats = Math.max(3, Math.floor(Number(listing.price_mnee)))
  const sellerSats = Math.max(1, Math.floor(totalSats * SELLER_SHARE))
  const platformSats = Math.max(1, Math.floor(totalSats * PLATFORM_SHARE))
  const curatorSats = Math.max(1, totalSats - sellerSats - platformSats) // remainder avoids rounding drift

  return {
    ok: true,
    sellerAddress: listing.seller_ord_address as string,
    platformAddress,
    curatorAddress,
    sellerSats,
    platformSats,
    curatorSats,
    totalSats,
  }
}

// ─── Purchase listing ─────────────────────────────────────────────────────────

/**
 * Complete a purchase: verify the buyer's payment transaction includes all
 * required split outputs, then deliver the ordinal from escrow.
 *
 * Revenue split enforced on ALL sales (primary + resale):
 *   75% → seller (artist on primary sale, collector on resale)
 *   15% → curator treasury (CURATOR_TREASURY_ADDRESS or platform wallet)
 *   10% → platform (PLATFORM_FUNDING_WIF address)
 */
export async function purchaseListingAction(
  listingId: string,
  buyerOrdAddress: string,
  paymentTxid: string,
): Promise<{ ok: boolean; saleTxid?: string; error?: string }> {
  if (!listingId || !buyerOrdAddress || !paymentTxid) {
    return { ok: false, error: 'listingId, buyerOrdAddress, and paymentTxid are required' }
  }

  const admin = createAdminClient()

  // Load and validate the listing
  const { data: listing } = await admin
    .from('ordinal_listings')
    .select('id, inscription_outpoint, seller_ord_address, price_mnee, escrow_txid, status')
    .eq('id', listingId)
    .eq('status', 'active')
    .maybeSingle()

  if (!listing) return { ok: false, error: 'Listing not found or not active' }
  if (!listing.escrow_txid) return { ok: false, error: 'Ordinal has not been transferred to escrow yet' }

  // Preflight: confirm the escrow UTXO is still unspent before the buyer signs anything
  const escrowCheck = await checkEscrowUtxo(listing.escrow_txid as string)
  if (escrowCheck === 'spent') {
    await admin
      .from('ordinal_listings')
      .update({ status: 'delisted_transferred', updated_at: new Date().toISOString() })
      .eq('id', listingId)
    return { ok: false, error: 'This listing is no longer available — the ordinal has moved from escrow. The listing has been removed.' }
  }

  // Verify all three split outputs are present in the payment tx
  const platformAddress = getPlatformEscrowAddress()
  const curatorAddress = process.env.CURATOR_TREASURY_ADDRESS ?? platformAddress
  const totalSats = Math.max(3, Math.floor(Number(listing.price_mnee)))
  const sellerSats = Math.max(1, Math.floor(totalSats * SELLER_SHARE))
  const platformSats = Math.max(1, Math.floor(totalSats * PLATFORM_SHARE))
  const curatorSats = Math.max(1, totalSats - sellerSats - platformSats)

  const paymentValid = await verifyPaymentSplit(paymentTxid, [
    { address: listing.seller_ord_address as string, minSats: sellerSats },
    { address: platformAddress, minSats: platformSats },
    ...(curatorAddress !== platformAddress
      ? [{ address: curatorAddress, minSats: curatorSats }]
      : [] // when curator == platform, the platform output covers both shares
    ),
  ])
  if (!paymentValid) {
    return { ok: false, error: 'Payment split could not be verified. Ensure seller received 75%, platform 10%, and curator treasury 15%.' }
  }

  // Collect all other active escrow txids so the delivery tx doesn't
  // accidentally consume another seller's ordinal as a fee input.
  const { data: otherListings } = await admin
    .from('ordinal_listings')
    .select('escrow_txid')
    .eq('status', 'active')
    .neq('id', listingId)
    .not('escrow_txid', 'is', null)

  const otherEscrowTxids = (otherListings ?? [])
    .map((l) => l.escrow_txid as string)
    .filter(Boolean)

  // Mark as processing to prevent double-delivery
  await admin
    .from('ordinal_listings')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', listingId)

  try {
    const saleTxid = await deliverOrdinalFromEscrow(listing.escrow_txid, buyerOrdAddress, otherEscrowTxids)

    await admin
      .from('ordinal_listings')
      .update({
        status: 'sold',
        buyer_ord_address: buyerOrdAddress,
        sale_txid: saleTxid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listingId)

    return { ok: true, saleTxid }
  } catch (err) {
    // Revert to active so the transaction can be retried
    await admin
      .from('ordinal_listings')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', listingId)
    return { ok: false, error: err instanceof Error ? err.message : 'Delivery failed' }
  }
}
