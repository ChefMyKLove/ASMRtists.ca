import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConnectedAccount, createOnboardingLink } from '@/lib/stripe/connect'

/**
 * GET /api/stripe/connect
 *
 * Authenticated artist route. Creates or reuses a Stripe Connect Express account
 * and returns a redirect to the Stripe onboarding URL.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, stripe_account_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'artist' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Only artists can connect a Stripe account' }, { status: 403 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const returnUrl = `${baseUrl}/dashboard/earnings?stripe=connected`

  // Reuse existing account or create a new one
  let accountId = profile.stripe_account_id as string | null

  if (!accountId) {
    try {
      accountId = await createConnectedAccount({ email: user.email ?? '' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `Failed to create Stripe account: ${msg}` }, { status: 500 })
    }

    // Persist account id
    await supabase
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
  }

  // Generate onboarding link
  let onboardingUrl: string
  try {
    onboardingUrl = await createOnboardingLink({
      accountId,
      returnUrl,
      refreshUrl: returnUrl,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Failed to create onboarding link: ${msg}` },
      { status: 500 }
    )
  }

  return NextResponse.redirect(onboardingUrl)
}
