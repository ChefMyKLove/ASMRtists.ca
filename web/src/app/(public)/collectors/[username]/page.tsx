import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'

interface CollectorPageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: CollectorPageProps): Promise<Metadata> {
  const { username } = await params
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, bio')
    .eq('username', username)
    .maybeSingle()
  const displayName = profile?.display_name ?? username
  return {
    title: `${displayName} — Collector — ASMRtists.ca`,
    description: profile?.bio ?? `${displayName}'s collection on ASMRtists.ca`,
  }
}

export default async function CollectorPage({ params }: CollectorPageProps) {
  const { username } = await params
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, banner_url')
    .eq('username', username)
    .maybeSingle()

  if (!profile) notFound()

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role, status')
    .eq('user_id', profile.id)
    .eq('role', 'collector')
    .maybeSingle()

  if (!roleRow) notFound()

  const displayName = profile.display_name ?? username
  const avatarUrl = profile.avatar_url ?? ''
  const bannerUrl = profile.banner_url ?? ''

  return (
    <div>
      {/* Banner */}
      <div className="relative h-52 sm:h-64 bg-gradient-to-br from-teal-900/40 via-emerald-900/40 to-cyan-900/40">
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
              <Badge variant="secondary" className="text-xs flex-shrink-0">Collector</Badge>
              {roleRow.status === 'active' && (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-0 flex-shrink-0">
                  Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">@{username}</p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mb-8">
            {profile.bio}
          </p>
        )}

        {/* Ordinals collection — requires on-chain lookup via GorillaPool */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-semibold">1Sat Ordinals</h2>
          <div className="glass rounded-2xl p-12 text-center space-y-2">
            <p className="text-sm font-medium">On-chain holdings</p>
            <p className="text-sm text-muted-foreground">
              Connect a BSV wallet on any collection page to verify ordinal ownership.
            </p>
            <p className="text-xs text-muted-foreground">
              Public ordinal display coming soon — verified via GorillaPool.
            </p>
          </div>
        </div>

        {/* Print orders — future feature */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-semibold">Print Orders</h2>
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-sm text-muted-foreground">
              Print order history will appear here once the feature is available.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
