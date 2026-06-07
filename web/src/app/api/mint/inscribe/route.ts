/**
 * POST /api/mint/inscribe
 *
 * Fetches a JPEG from Supabase Storage, inscribes it as a 1Sat Ordinal,
 * and updates the artwork row with the txid and inscription ID.
 *
 * Called by the background pipeline after ordinal_prep completes.
 * Protected: requires CRON_SECRET header (set as Vercel cron secret).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inscribeWithRetry } from '@/lib/bsv/inscribe'

export async function POST(req: NextRequest) {
  // Verify internal call
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { artworkId } = await req.json()
  if (!artworkId) {
    return NextResponse.json({ error: 'artworkId is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Load artwork row
  const { data: artwork, error: fetchErr } = await admin
    .from('artwork')
    .select('id, jpeg_storage_path, artist_id')
    .eq('id', artworkId)
    .single()

  if (fetchErr || !artwork) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  if (!artwork.jpeg_storage_path) {
    return NextResponse.json({ error: 'JPEG not ready — run ordinal_prep first' }, { status: 422 })
  }

  // Resolve artist's BSV address via user_id → wallets join
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('user_id')
    .eq('id', artwork.artist_id)
    .single()

  const { data: wallet } = ap
    ? await admin.from('wallets').select('address').eq('user_id', ap.user_id).maybeSingle()
    : { data: null }

  const walletAddress = wallet?.address
  if (!walletAddress) {
    return NextResponse.json({ error: 'Artist BSV wallet address not found' }, { status: 422 })
  }

  // Mark as processing
  await admin
    .from('artwork')
    .update({ status: 'minting' })
    .eq('id', artworkId)

  try {
    // Download JPEG from Supabase Storage
    const { data: fileData, error: dlErr } = await admin
      .storage
      .from('artwork-originals')
      .download(artwork.jpeg_storage_path)

    if (dlErr || !fileData) throw new Error(`Storage download failed: ${dlErr?.message}`)

    const jpegBuffer = Buffer.from(await fileData.arrayBuffer())

    // Inscribe on-chain
    const result = await inscribeWithRetry({
      jpegData: jpegBuffer,
      recipientAddress: walletAddress,
      metadata: {
        app: 'ASMRtists',
        type: 'ord',
        artworkId: String(artworkId),
      },
    })

    // Persist result
    await admin
      .from('artwork')
      .update({
        status: 'minted',
        inscription_txid: result.txid,
        inscription_outpoint: result.outpoint,
      })
      .eq('id', artworkId)

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await admin
      .from('artwork')
      .update({ status: 'mint_error', error_message: message })
      .eq('id', artworkId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
