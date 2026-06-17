import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const WOC_API_KEY = process.env.WOC_API_KEY

async function checkEscrowUtxo(escrowTxid: string): Promise<'valid' | 'spent' | 'unknown'> {
  try {
    const headers: Record<string, string> = {}
    if (WOC_API_KEY) headers['Authorization'] = WOC_API_KEY

    const res = await fetch(`https://api.1sat.app/1sat/txo/${escrowTxid}.0`, {
      headers,
      cache: 'no-store',
    })
    if (!res.ok) return 'unknown'
    const txo = await res.json() as Record<string, unknown>
    return txo.spend ? 'spent' : 'valid'
  } catch {
    return 'unknown'
  }
}

/**
 * POST /api/ordinals/revalidate
 *
 * Sweeps all active listings and marks any whose escrow UTXO has been spent
 * outside the normal delivery flow as 'delisted_transferred'.
 *
 * Protected by REVALIDATE_SECRET env var. Call this from a cron job or
 * manually via the admin panel.
 *
 * Body: { secret: string }
 * Response: { checked: number; delisted: number; errors: number }
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (secret) {
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* empty body */ }
    if (body.secret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  const { data: listings, error } = await admin
    .from('ordinal_listings')
    .select('id, escrow_txid')
    .eq('status', 'active')
    .not('escrow_txid', 'is', null)
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let checked = 0
  let delisted = 0
  let errors = 0

  for (const listing of listings ?? []) {
    const status = await checkEscrowUtxo(listing.escrow_txid as string)
    checked++

    if (status === 'spent') {
      const { error: updateErr } = await admin
        .from('ordinal_listings')
        .update({ status: 'delisted_transferred', updated_at: new Date().toISOString() })
        .eq('id', listing.id)
        .eq('status', 'active')

      if (updateErr) {
        errors++
      } else {
        delisted++
      }
    } else if (status === 'unknown') {
      errors++
    }
  }

  return NextResponse.json({ checked, delisted, errors })
}
