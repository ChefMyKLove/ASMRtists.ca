import type { Metadata } from 'next'

export const revalidate = 300

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

  // Build artist_id → user_id map for collection lookups
  const artistToUserMap = new Map(profiles.map((ap) => [ap.id as string, ap.user_id as string]))

  // Fetch usernames, profile images, ordinals flags, and collections in parallel
  const [profilesRes, artworksRes, collectionsRes] = await Promise.all([
    userIds.length > 0
      ? admin.from('profiles').select('id, username, avatar_url, banner_url').in('id', userIds)
      : Promise.resolve({ data: [] }),
    artistIds.length > 0
      ? admin.from('artwork').select('artist_id, inscription_outpoint').in('artist_id', artistIds)
      : Promise.resolve({ data: [] }),
    artistIds.length > 0
      ? admin
          .from('collections')
          .select('id, title, slug, cover_image_url, piece_count, artist_id')
          .eq('status', 'active')
          .in('artist_id', artistIds)
          .order('created_at', { ascending: false })
          .limit(24)
      : Promise.resolve({ data: [] }),
  ])

  const profileDataMap = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id as string,
      {
        username: p.username as string,
        avatarUrl: p.avatar_url as string | null,
        bannerUrl: p.banner_url as string | null,
      },
    ])
  )
  const usernameMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id as string, p.username as string])
  )

  const ordinalsSet = new Set<string>()
  const artworkCountMap = new Map<string, number>()
  for (const aw of artworksRes.data ?? []) {
    const artistId = aw.artist_id as string
    if (aw.inscription_outpoint) ordinalsSet.add(artistId)
    artworkCountMap.set(artistId, (artworkCountMap.get(artistId) ?? 0) + 1)
  }

  const artists = profiles.map((ap) => {
    const profileData = profileDataMap.get(ap.user_id as string)
    return {
      slug: profileData?.username ?? (ap.user_id as string),
      displayName: (ap.stage_name as string | null) ?? 'Unknown Artist',
      bio: ap.bio as string | null,
      artworkCount: artworkCountMap.get(ap.id as string) ?? (ap.piece_count as number) ?? 0,
      isFeatured: (artworkCountMap.get(ap.id as string) ?? (ap.piece_count as number) ?? 0) >= 3,
      hasOrdinals: ordinalsSet.has(ap.id as string),
      hasPrints: false,
      // Use artist_profiles image first; fall back to profiles image
      bannerUrl: (ap.banner_url as string | null) ?? profileData?.bannerUrl ?? null,
      avatarUrl: (ap.avatar_url as string | null) ?? profileData?.avatarUrl ?? null,
    }
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  function coverUrl(path: string | null): string | null {
    if (!path) return null
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    return `${supabaseUrl}/storage/v1/object/public/artwork-originals/${encoded}`
  }

  const collections = (collectionsRes.data ?? []).map((col) => {
    const userId = artistToUserMap.get(col.artist_id as string)
    const profileData = userId ? profileDataMap.get(userId) : undefined
    return {
      id: col.id as string,
      title: col.title as string,
      slug: col.slug as string,
      artistSlug: profileData?.username ?? '',
      artistName: profiles.find(ap => ap.id === col.artist_id)
        ? ((profiles.find(ap => ap.id === col.artist_id)?.stage_name as string | null) ?? 'Artist')
        : 'Artist',
      coverImageUrl: (col.cover_image_url as string | null)
        ? coverUrl(col.cover_image_url as string)
        : null,
      pieceCount: (col.piece_count as number) ?? 0,
    }
  }).filter((c) => c.artistSlug !== '')

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Browse</h1>
        <p className="text-muted-foreground">
          Discover independent artists and their collections.
        </p>
      </div>
      <BrowseClient artists={artists} collections={collections} />
    </div>
  )
}
