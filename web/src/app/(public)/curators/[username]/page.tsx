import type { Metadata } from 'next'

export const revalidate = 300

import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { createAdminClient } from '@/lib/supabase/admin'

interface CuratorPageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: CuratorPageProps): Promise<Metadata> {
  const { username } = await params
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, bio')
    .eq('username', username)
    .maybeSingle()
  const displayName = profile?.display_name ?? username
  return {
    title: `${displayName} — Curator — ASMRtists.ca`,
    description: profile?.bio ?? `${displayName} is a curator on ASMRtists.ca`,
  }
}

export default async function CuratorPage({ params }: CuratorPageProps) {
  const { username } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, banner_url')
    .eq('username', username)
    .maybeSingle()

  if (!profile) notFound()

  const { data: curatorProfile } = await admin
    .from('curator_profiles')
    .select('id, display_name, bio, avatar_url, organization, artist_count, status')
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!curatorProfile) notFound()

  // Curated collections with artist info
  const { data: collections } = await admin
    .from('collections')
    .select('id, title, slug, cover_image_url, status, artist_id')
    .eq('curator_id', curatorProfile.id)
    .in('status', ['active', 'pending_review'])
    .order('created_at', { ascending: false })

  // Get artist profiles for those collections to build /c/[username]/[slug] links
  const artistIds = [...new Set((collections ?? []).map((c) => c.artist_id).filter(Boolean))]
  const { data: artistProfiles } = artistIds.length
    ? await admin
        .from('artist_profiles')
        .select('id, stage_name, user_id')
        .in('id', artistIds)
    : { data: [] }

  const artistUserIds = (artistProfiles ?? []).map((a) => a.user_id)
  const { data: artistUsers } = artistUserIds.length
    ? await admin
        .from('profiles')
        .select('id, username')
        .in('id', artistUserIds)
    : { data: [] }

  // Build lookup: artist_profiles.id → username
  const artistUsernameMap: Record<string, string> = {}
  for (const ap of artistProfiles ?? []) {
    const user = (artistUsers ?? []).find((u) => u.id === ap.user_id)
    if (user) artistUsernameMap[ap.id] = user.username
  }

  const displayName = curatorProfile.display_name ?? profile.display_name ?? username
  const bio = curatorProfile.bio ?? profile.bio ?? ''
  const avatarUrl = curatorProfile.avatar_url ?? profile.avatar_url ?? ''
  const bannerUrl = profile.banner_url ?? ''

  return (
    <div>
      {/* Banner */}
      <div className="relative h-52 sm:h-64 bg-gradient-to-br from-pink-900/40 via-purple-900/40 to-indigo-900/40">
        {bannerUrl && (
          <Image
            src={bannerUrl}
            alt={`${displayName} banner`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Profile header */}
        <div className="relative -mt-10 mb-8 flex items-end gap-4">
          <Avatar className="h-20 w-20 ring-4 ring-[#0a0a0f] flex-shrink-0">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-white/10 text-xl">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="pb-1 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{displayName}</h1>
              <Badge variant="secondary" className="text-xs flex-shrink-0">Curator</Badge>
              {curatorProfile.status === 'active' && (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-0 flex-shrink-0">
                  Verified
                </Badge>
              )}
            </div>
            {curatorProfile.organization && (
              <p className="text-xs text-muted-foreground">{curatorProfile.organization}</p>
            )}
          </div>
        </div>

        {bio && (
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mb-8">{bio}</p>
        )}

        {/* Stats row */}
        <div className="flex gap-6 mb-10">
          <div>
            <p className="text-xl font-bold">{collections?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Collections curated</p>
          </div>
          <div>
            <p className="text-xl font-bold">{curatorProfile.artist_count}</p>
            <p className="text-xs text-muted-foreground">Artists represented</p>
          </div>
        </div>

        {/* Curated collections */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-semibold">Curated Collections</h2>
          {!collections || collections.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-sm text-muted-foreground">No active collections yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((col) => {
                const artistUsername = col.artist_id ? artistUsernameMap[col.artist_id] : null
                const href = artistUsername ? `/c/${artistUsername}/${col.slug}` : '#'
                return (
                  <Link key={col.id} href={href}>
                    <Card className="glass overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
                      <div className="relative aspect-video bg-white/5">
                        {col.cover_image_url ? (
                          <Image
                            src={col.cover_image_url}
                            alt={col.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-blue-900/40" />
                        )}
                      </div>
                      <CardContent className="p-3 space-y-1">
                        <p className="text-sm font-medium truncate">{col.title}</p>
                        <Badge variant="outline" className="text-[10px] border-white/20">
                          {col.status === 'active' ? 'Active' : 'In Review'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Represented artists — placeholder until a dedicated query is built */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-semibold">Represented Artists</h2>
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Full artist roster coming soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
