import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CurateClient } from './curate-client'
import { artworkStorageUrl } from '@/lib/utils'

export const metadata: Metadata = { title: 'Review Queue — Dashboard' }

function buildStorageUrl(path: string | null): string {
  return artworkStorageUrl(path) ?? ''
}

export default async function CuratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()

  if (profile?.active_role !== 'curator' && profile?.active_role !== 'admin') {
    redirect('/dashboard')
  }

  // Find artworks belonging to collections awaiting curator review
  const { data: pendingCollections } = await admin
    .from('collections')
    .select('id')
    .eq('status', 'pending_review')

  const pendingCollectionIds = (pendingCollections ?? []).map((c) => c.id as string)

  const { data: pendingArtwork } = pendingCollectionIds.length > 0
    ? await admin
        .from('artwork')
        .select('id, title, storage_path, thumbnail_url, created_at, artist_id')
        .in('collection_id', pendingCollectionIds)
        .eq('status', 'uploaded')
        .order('created_at', { ascending: true })
    : { data: [] }

  const artistIds = [...new Set((pendingArtwork ?? []).map((a) => a.artist_id).filter(Boolean))]

  const { data: artistProfiles } = artistIds.length > 0
    ? await admin
        .from('artist_profiles')
        .select('id, stage_name')
        .in('id', artistIds)
    : { data: [] }

  const artistMap: Record<string, string> = Object.fromEntries(
    (artistProfiles ?? []).map((ap) => [ap.id, ap.stage_name ?? 'Unknown Artist'])
  )

  const items = (pendingArtwork ?? []).map((a) => ({
    id: a.id as string,
    title: a.title as string,
    thumbnailUrl: (a.thumbnail_url as string | null) ?? buildStorageUrl(a.storage_path as string | null),
    artistName: artistMap[a.artist_id as string] ?? 'Unknown Artist',
    createdAt: a.created_at as string,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {items.length === 0
            ? 'No artwork pending review.'
            : `${items.length} submission${items.length === 1 ? '' : 's'} awaiting approval`}
        </p>
      </div>
      <CurateClient items={items} />
    </div>
  )
}
