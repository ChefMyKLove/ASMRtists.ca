import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Curators — ASMRtists.ca',
  description: 'Browse the curators shaping the ASMRtists roster.',
}

export default async function CuratorsPage() {
  const admin = createAdminClient()

  const { data: curatorProfiles } = await admin
    .from('curator_profiles')
    .select('id, organization, bio, avatar_url, artist_count, status, user_id')
    .eq('status', 'active')
    .order('artist_count', { ascending: false })

  const userIds = (curatorProfiles ?? []).map((c) => c.user_id).filter(Boolean)

  const { data: profiles } = userIds.length
    ? await admin
        .from('profiles')
        .select('id, username, display_name, avatar_url, banner_url')
        .in('id', userIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const curators = (curatorProfiles ?? [])
    .map((cp) => {
      const profile = profileMap.get(cp.user_id)
      if (!profile?.username) return null
      return { ...cp, profile }
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof mapCurator>>[]

  function mapCurator(cp: (typeof curatorProfiles)[number], profile: (typeof profiles)[number]) {
    return { ...cp, profile }
  }
  void mapCurator

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Curators</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Curators champion artists, build themed galleries, and shape what gets represented on the roster.
        </p>
      </div>

      {curators.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <p className="text-muted-foreground text-sm">No active curators yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {curators.map((curator) => {
            const displayName = curator.profile.display_name ?? curator.profile.username
            const avatarUrl = curator.avatar_url ?? curator.profile.avatar_url ?? ''
            return (
              <Link
                key={curator.id}
                href={`/curators/${curator.profile.username}`}
                className="glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200 flex flex-col"
              >
                {/* Banner strip */}
                <div className="relative h-20 bg-gradient-to-br from-pink-900/40 via-purple-900/40 to-indigo-900/40">
                  {curator.profile.banner_url && (
                    <Image
                      src={curator.profile.banner_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  )}
                </div>

                <div className="px-5 pb-5 flex-1 flex flex-col">
                  {/* Avatar */}
                  <div className="-mt-8 mb-3">
                    <Avatar className="h-14 w-14 ring-4 ring-[#0a0a0f]">
                      <AvatarImage src={avatarUrl} alt={displayName} />
                      <AvatarFallback className="bg-white/10 text-base">
                        {displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{displayName}</p>
                      {curator.organization && (
                        <p className="text-[11px] text-muted-foreground truncate">{curator.organization}</p>
                      )}
                    </div>
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-0 flex-shrink-0">
                      Verified
                    </Badge>
                  </div>

                  {curator.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                      {curator.bio}
                    </p>
                  )}

                  <div className="mt-auto flex gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-white">{curator.artist_count ?? 0}</strong> artists</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
