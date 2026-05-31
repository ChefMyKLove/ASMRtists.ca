import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const single = searchParams.get('inscriptionOutpoint')
  const multi = searchParams.get('outpoints')

  let outpoints: string[] = []
  if (single) {
    outpoints = [single]
  } else if (multi) {
    outpoints = multi.split(',').map((s) => s.trim()).filter(Boolean)
  }

  if (outpoints.length === 0) {
    return NextResponse.json({ balances: [] })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reward_allocations')
    .select('inscription_outpoint, mnee_claimable, bsv_claimable, bsv21_claimable')
    .in('inscription_outpoint', outpoints)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const balances = (data ?? []).map((row) => ({
    outpoint: row.inscription_outpoint as string,
    mnee_claimable: Number(row.mnee_claimable),
    bsv_claimable: Number(row.bsv_claimable),
    bsv21_claimable: Number(row.bsv21_claimable),
  }))

  return NextResponse.json({ balances })
}
