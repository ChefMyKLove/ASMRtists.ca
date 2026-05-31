/**
 * Referral system helpers
 *
 * Referral code is stored in profiles.social_links as:
 *   { referral_code: string, referred_by: string }
 *
 * TODO: trigger reward when referred user makes first purchase
 */

/** Generate a short referral code from a user ID */
export function generateReferralCode(userId: string): string {
  return userId.slice(0, 8).toUpperCase()
}

/**
 * Record that `referredUserId` signed up using `referralCode`.
 * Looks up the referring user and updates the referred user's profile.
 */
export async function trackReferral(
  referredUserId: string,
  referralCode: string,
  // biome-ignore lint/suspicious/noExplicitAny: Supabase client passed from caller
  supabase: any
): Promise<void> {
  if (!referralCode || !referredUserId) return

  // Find the profile whose referral_code matches
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, social_links')

  if (!profiles) return

  const referrer = profiles.find((p: { id: string; social_links: unknown }) => {
    const links = p.social_links as Record<string, string> | null
    return links?.referral_code === referralCode
  })

  if (!referrer || referrer.id === referredUserId) return

  // Update the referred user's profile with who referred them
  const { data: referredProfile } = await supabase
    .from('profiles')
    .select('social_links')
    .eq('id', referredUserId)
    .single()

  const existingLinks = (referredProfile?.social_links as Record<string, string> | null) ?? {}

  // Don't overwrite if already set
  if (existingLinks.referred_by) return

  await supabase
    .from('profiles')
    .update({
      social_links: {
        ...existingLinks,
        referred_by: referrer.id,
      },
    })
    .eq('id', referredUserId)

  // TODO: trigger reward when referred user makes first purchase
  // e.g. insert into referral_rewards where referrer_id = referrer.id
}
