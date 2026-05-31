/**
 * POST /api/ordinals/claim
 *
 * Processes a reward claim for an Ordinal Rainbows holder.
 *
 * Flow:
 *   1. Verify the signed challenge (proves wallet ownership)
 *   2. Re-verify current on-chain ownership via GorillaPool
 *   3. Look up claimable rewards in reward_allocations
 *   4. Insert an ordinal_claims row
 *   5. Send BSV from treasury → recipient
 *   6. Mark claim paid + zero out allocation
 *
 * Body:
 *   {
 *     inscriptionOutpoint: string,   // e.g. "abc123_0"
 *     ordAddress:          string,   // ordinal-receiving address (ownership proof)
 *     bsvAddress:          string,   // BSV payment address (where to send sats)
 *     nonce:               string,   // challenge issued by /api/ordinals/challenge
 *     signature:           string,   // base64 BSV signed message of nonce
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyChallenge, verifyOwnership } from '@/lib/bsv/auth'
import { sendBsvFromTreasury } from '@/lib/bsv/payout'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { inscriptionOutpoint, ordAddress, bsvAddress, nonce, signature } = body ?? {}

    if (!inscriptionOutpoint || !ordAddress || !bsvAddress || !nonce || !signature) {
      return NextResponse.json(
        { error: 'inscriptionOutpoint, ordAddress, bsvAddress, nonce, and signature are required' },
        { status: 400 },
      )
    }

    // 1. Verify the challenge signature
    const { valid, reason } = await verifyChallenge(ordAddress, nonce, signature)
    if (!valid) {
      return NextResponse.json({ error: `Authentication failed: ${reason}` }, { status: 403 })
    }

    // 2. Re-verify on-chain ownership
    const isOwner = await verifyOwnership(inscriptionOutpoint, ordAddress)
    if (!isOwner) {
      return NextResponse.json({ error: 'Ownership verification failed — you do not hold this ordinal' }, { status: 403 })
    }

    const admin = createAdminClient()

    // 3. Load reward allocation
    const { data: alloc } = await admin
      .from('reward_allocations')
      .select('id, artwork_id, bsv_claimable, mnee_claimable')
      .eq('inscription_outpoint', inscriptionOutpoint)
      .maybeSingle()

    if (!alloc) {
      return NextResponse.json({ error: 'No reward allocation found for this inscription' }, { status: 404 })
    }

    const bsvSats = Number(alloc.bsv_claimable ?? 0)
    const mneeAmt = Number(alloc.mnee_claimable ?? 0)

    if (bsvSats <= 0 && mneeAmt <= 0) {
      return NextResponse.json({ error: 'Nothing to claim right now' }, { status: 409 })
    }

    // 4. Check for a pending/recent claim to prevent duplicates
    const { data: existing } = await admin
      .from('ordinal_claims')
      .select('id, status')
      .eq('inscription_outpoint', inscriptionOutpoint)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.status === 'pending') {
      return NextResponse.json({ error: 'A payout is already pending for this inscription' }, { status: 409 })
    }

    // 5. Insert pending claim
    const { data: claim, error: claimErr } = await admin
      .from('ordinal_claims')
      .insert({
        inscription_outpoint: inscriptionOutpoint,
        artwork_id: alloc.artwork_id,
        ord_address: ordAddress,
        recipient_address: bsvAddress,
        bsv_amount: bsvSats,
        mnee_amount: mneeAmt,
        status: 'pending',
      })
      .select('id')
      .single()

    if (claimErr || !claim) {
      return NextResponse.json({ error: claimErr?.message ?? 'Failed to create claim' }, { status: 500 })
    }

    // 6. Execute BSV payout
    if (bsvSats > 0) {
      try {
        const txid = await sendBsvFromTreasury(bsvAddress, bsvSats)

        await admin
          .from('ordinal_claims')
          .update({ status: 'paid', txid, paid_at: new Date().toISOString() })
          .eq('id', claim.id)

        await admin
          .from('reward_allocations')
          .update({ bsv_claimable: 0 })
          .eq('id', alloc.id)

        return NextResponse.json({ success: true, txid, bsvSats, message: 'BSV sent!' })
      } catch (payErr) {
        const msg = payErr instanceof Error ? payErr.message : String(payErr)
        console.error('[/api/ordinals/claim] payout failed:', msg)

        // Leave claim as pending — ops can retry manually
        return NextResponse.json({ success: false, claimId: claim.id, error: msg }, { status: 500 })
      }
    }

    // MNEE path (treasury distributes MNEE — no on-chain tx yet)
    return NextResponse.json({ success: true, claimId: claim.id, message: 'Claim registered — MNEE payout pending' })
  } catch (err) {
    console.error('[/api/ordinals/claim]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
