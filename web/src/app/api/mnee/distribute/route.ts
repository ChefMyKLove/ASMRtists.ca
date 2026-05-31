import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { distributeMnee, type MneeRecipient } from '@/lib/mnee/treasury'

/**
 * POST /api/mnee/distribute
 *
 * Admin-only. Fetches all ordinal_claims with status = 'pending',
 * groups by BSV address, calls distributeMnee(), and marks claims as 'processing'.
 */
export async function POST() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch pending ordinal claims with BSV address
  const { data: claims, error: claimsError } = await supabase
    .from('ordinal_claims')
    .select('id, bsv_address, amount')
    .eq('status', 'pending')

  if (claimsError) {
    return NextResponse.json(
      { error: `Failed to fetch claims: ${claimsError.message}` },
      { status: 500 }
    )
  }

  if (!claims || claims.length === 0) {
    return NextResponse.json({ ok: true, ticketId: null, recipientCount: 0 })
  }

  // Group by BSV address, sum amounts
  const grouped = new Map<string, { total: number; ids: string[] }>()
  for (const claim of claims) {
    if (!claim.bsv_address) continue
    const existing = grouped.get(claim.bsv_address)
    if (existing) {
      existing.total += claim.amount ?? 0
      existing.ids.push(claim.id)
    } else {
      grouped.set(claim.bsv_address, { total: claim.amount ?? 0, ids: [claim.id] })
    }
  }

  const recipients: MneeRecipient[] = Array.from(grouped.entries()).map(([address, { total }]) => ({
    address,
    amount: total,
  }))

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'No claims with valid BSV addresses found' },
      { status: 422 }
    )
  }

  // Distribute MNEE
  let ticketId: string
  try {
    ticketId = await distributeMnee(recipients)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `MNEE transfer failed: ${msg}` }, { status: 500 })
  }

  // Mark all claims as processing with the ticketId
  const allIds = Array.from(grouped.values()).flatMap((g) => g.ids)

  await supabase
    .from('ordinal_claims')
    .update({ status: 'processing', notes: `ticketId:${ticketId}` })
    .in('id', allIds)

  return NextResponse.json({ ok: true, ticketId, recipientCount: recipients.length })
}
