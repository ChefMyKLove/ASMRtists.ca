import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

// TODO: create these products in Stripe dashboard and set the env vars
const TIER_PRICE_IDS: Record<string, string | undefined> = {
  emerging:    process.env.STRIPE_PRICE_CURATOR_EMERGING,
  gallery:     process.env.STRIPE_PRICE_CURATOR_GALLERY,
  institution: process.env.STRIPE_PRICE_CURATOR_INSTITUTION,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await req.json() as { tier: string }
  const priceId = TIER_PRICE_IDS[tier]

  // Placeholder: Stripe not yet configured — return a flag so the UI can show a pending state
  if (!priceId) {
    return NextResponse.json({ pending: true })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: user.id, curator_tier: tier },
    success_url: `${baseUrl}/register/curator/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${baseUrl}/register/curator?step=3`,
  })

  return NextResponse.json({ url: session.url })
}
