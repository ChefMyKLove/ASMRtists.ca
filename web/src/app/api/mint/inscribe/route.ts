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
import { createClient } from '@/lib/supabase/server'
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

  const supabase = await createClient()

  // Load artwork row
  const { data: artwork, error: fetchErr } = await supabase
    .from('artwork')
    .select('id, jpeg_storage_path, artist_id, collections(artist_profiles(wallets(address)))')
    .eq('id', artworkId)
    .single()

  if (fetchErr || !artwork) {
    return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
  }

  if (!artwork.jpeg_storage_path) {
    return NextResponse.json({ error: 'JPEG not ready — run ordinal_prep first' }, { status: 422 })
  }

  // Resolve artist's BSV address
  const walletAddress = (artwork as any)?.collections?.artist_profiles?.wallets?.address
  if (!walletAddress) {
    return NextResponse.json({ error: 'Artist BSV wallet address not found' }, { status: 422 })
  }

  // Mark as processing
  await supabase
    .from('artwork')
    .update({ status: 'minting' })
    .eq('id', artworkId)

  try {
    // Download JPEG from Supabase Storage
    const { data: fileData, error: dlErr } = await supabase
      .storage
      .from('artwork-jpegs')
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
    await supabase
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

    await supabase
      .from('artwork')
      .update({ status: 'mint_error', error_message: message })
      .eq('id', artworkId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
