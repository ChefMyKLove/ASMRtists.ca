import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProfileEditor } from '@/components/dashboard/profile-editor'

export const metadata: Metadata = { title: 'Profile — Dashboard' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()

  // Fetch all profile data in parallel
  const [profileRes, artistRes, walletRes, rolesRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', user.id).single(),
    admin.from('artist_profiles')
      .select('stage_name, bio, avatar_url, banner_url, location, status, piece_count')
      .eq('user_id', user.id)
      .maybeSingle(),
    admin.from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('label', 'Primary')
      .maybeSingle(),
    admin.from('user_roles')
      .select('role, status')
      .eq('user_id', user.id),
  ])

  const profile = profileRes.data
  if (!profile) notFound()

  const artistProfile = artistRes.data ?? null
  const wallet = walletRes.data ?? null
  const userRoles = rolesRes.data ?? []

  const socialLinks = (profile.social_links as Record<string, string> | null) ?? {}

  return (
    <ProfileEditor
      userId={user.id}
      username={profile.username}
      email={user.email ?? ''}
      displayName={profile.display_name ?? null}
      bio={artistProfile?.bio ?? profile.bio ?? null}
      avatarUrl={profile.avatar_url ?? null}
      bannerUrl={profile.banner_url ?? null}
      socialLinks={socialLinks}
      bsvAddress={wallet?.address ?? null}
      artistProfile={artistProfile}
      userRoles={userRoles}
    />
  )
}

