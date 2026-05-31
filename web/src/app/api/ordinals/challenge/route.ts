/**
 * POST /api/ordinals/challenge
 *
 * Issues a short-lived nonce that the collector's wallet must sign
 * to prove ownership before a reward claim is processed.
 *
 * Body: { ordAddress: string }
 * Returns: { nonce: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { issueChallenge } from '@/lib/bsv/auth'

export async function POST(req: NextRequest) {
  try {
    const { ordAddress } = await req.json()
    if (!ordAddress || typeof ordAddress !== 'string') {
      return NextResponse.json({ error: 'ordAddress is required' }, { status: 400 })
    }

    const nonce = await issueChallenge(ordAddress.trim())
    return NextResponse.json({ nonce })
  } catch (err) {
    console.error('[/api/ordinals/challenge]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
