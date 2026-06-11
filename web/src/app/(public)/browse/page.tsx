import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { BrowseClient } from './browse-client'

export const metadata: Metadata = {
  title: 'Browse — ASMRtists.ca',
  description: 'Discover independent artists and their original work. Filter by curator, collection, prints, and ordinals.',
}

export default async function BrowsePage() {
  const admin = createAdminClient()

  // Fetch active artist profiles
  const { data: artistProfiles } = await admin
    .from('artist_profiles')
    .select('id, user_id, stage_name, bio, avatar_url, banner_url, piece_count')
    .eq('status', 'active')
    .order('piece_count', { ascending: false })
    .limit(48)

  const profiles = artistProfiles ?? []
  const userIds = profiles.map((a) => a.user_id)
  const artistIds = profiles.map((a) => a.id)

  // Fetch usernames and ordinals flags in parallel
  const [profilesRes, artworksRes] = await Promise.all([
    userIds.length > 0
      ? admin.from('profiles').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [] }),
    artistIds.length > 0
      ? admin.from('artwork').select('artist_id, inscription_outpoint').in('artist_id', artistIds)
      : Promise.resolve({ data: [] }),
  ])

  const usernameMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.username as string]))

  const ordinalsSet = new Set<string>()
  const artworkCountMap = new Map<string, number>()
  for (const aw of artworksRes.data ?? []) {
    const artistId = aw.artist_id as string
    if (aw.inscription_outpoint) ordinalsSet.add(artistId)
    artworkCountMap.set(artistId, (artworkCountMap.get(artistId) ?? 0) + 1)
  }

  const artists = profiles.map((ap) => ({
    slug: usernameMap.get(ap.user_id) ?? ap.user_id,
    displayName: (ap.stage_name as string | null) ?? 'Unknown Artist',
    bio: ap.bio as string | null,
    artworkCount: artworkCountMap.get(ap.id as string) ?? (ap.piece_count as number) ?? 0,
    isFeatured: (artworkCountMap.get(ap.id as string) ?? (ap.piece_count as number) ?? 0) >= 3,
    hasOrdinals: ordinalsSet.has(ap.id as string),
    hasPrints: false,
    bannerUrl: ap.banner_url as string | null,
    avatarUrl: ap.avatar_url as string | null,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Browse Artists</h1>
        <p className="text-muted-foreground">
          Discover independent artists and their original work.
        </p>
      </div>
      <BrowseClient artists={artists} />
    </div>
  )
}
