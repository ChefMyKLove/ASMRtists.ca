import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { AnimatedRoster } from '@/components/splash/animated-roster'

export const metadata: Metadata = {
  title: 'ASMRtists.ca — Art Splash Marketing Roster',
  description:
    'A curated marketplace for independent artists. Buy museum-quality prints, collect BSV ordinals, or join the roster.',
}

const roles = [
  {
    key: 'collector',
    label: 'I want to discover art',
    description:
      'Browse the full roster and buy museum-quality prints — no account needed. Create a profile to join the community and leaderboard. Add a BSV wallet to collect ordinals and earn a share of every print they sell.',
    cta: 'Browse the marketplace',
    href: '/browse',
    color: 'text-[#b3f0c8]',
    accentBorder: 'border-[#b3f0c8]/30',
    badge: 'No sign-up needed',
    badgeColor: 'bg-[#b3f0c8]/10 text-[#b3f0c8]',
    featured: true,
  },
  {
    key: 'artist',
    label: 'I want to share my work',
    description:
      'Join the roster as a represented artist. Upload your collection, get prints fulfilled on demand worldwide, and have your work inscribed as BSV ordinals — with a community of collectors who are invested in your success.',
    cta: 'Apply as an artist',
    href: '/register/artist',
    color: 'text-[#c4b0ff]',
    accentBorder: 'border-[#c4b0ff]/30',
    badge: null,
    badgeColor: '',
    featured: false,
  },
  {
    key: 'curator',
    label: 'I want to champion artists',
    description:
      'Surface great work, build your reputation, and earn a share of every sale you help drive. Curators are the tastemakers and long-term stewards of the ASMRtists roster.',
    cta: 'Become a curator',
    href: '/register/curator',
    color: 'text-[#ffb3d1]',
    accentBorder: 'border-[#ffb3d1]/30',
    badge: null,
    badgeColor: '',
    featured: false,
  },
]

type FeaturedCollection = {
  id: string
  title: string
  description: string | null
  cover_image_url: string | null
  slug: string
  piece_count: number
  artist: {
    stage_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
}

async function getFeaturedCollection(): Promise<FeaturedCollection | null> {
  try {
    const admin = createAdminClient()

    const { data: setting } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'featured_collection_id')
      .single()

    const collectionId: string | null =
      setting?.value ? String(setting.value).replace(/"/g, '') : null

    let collectionQuery = admin
      .from('collections')
      .select('id, title, description, cover_image_url, slug, piece_count, artist_id')
      .eq('status', 'active')

    if (collectionId) {
      collectionQuery = collectionQuery.eq('id', collectionId)
    } else {
      collectionQuery = collectionQuery
        .gt('piece_count', 0)
        .order('created_at', { ascending: false })
        .limit(1)
    }

    const { data: collections } = await collectionQuery
    const collection = collections?.[0]
    if (!collection) return null

    const { data: artistProfile } = await admin
      .from('artist_profiles')
      .select('stage_name, avatar_url, user_id')
      .eq('id', collection.artist_id)
      .single()

    let username: string | null = null
    if (artistProfile?.user_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('username')
        .eq('id', artistProfile.user_id)
        .single()
      username = profile?.username ?? null
    }

    return {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      cover_image_url: collection.cover_image_url,
      slug: collection.slug,
      piece_count: collection.piece_count,
      artist: artistProfile
        ? { stage_name: artistProfile.stage_name, avatar_url: artistProfile.avatar_url, username }
        : null,
    }
  } catch {
    return null
  }
}

export default async function HomePage() {
  const featured = await getFeaturedCollection()

  return (
    // Full-viewport split: left = copy + roles, right = featured collection
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col lg:flex-row">

      {/* ── Left column ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 xl:px-20 py-14 lg:py-20 lg:max-w-[52%]">

        <AnimatedRoster />

        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
          A place where your art finds its people.
        </h1>

        <p className="text-base text-muted-foreground font-light leading-relaxed mb-8 max-w-lg">
          ASMRtists represents independent artists — prints fulfilled on demand,
          digital artifacts on-chain, and a community of collectors who grow
          alongside the artists they love.
        </p>

        {/* Role cards — compact 3-col on desktop left, single col on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3 mb-8">
          {roles.map((role) => (
            <div
              key={role.key}
              className={cn(
                'glass rounded-xl p-6 flex flex-col gap-4',
                role.featured && `border ${role.accentBorder}`,
              )}
            >
              <div className="flex-1 space-y-2">
                <h2 className={cn('font-bold text-xl leading-snug', role.color)}>
                  {role.label}
                </h2>
              {role.badge && (
                <span className={cn('text-[9px] font-medium px-2 py-0.5 rounded-full w-fit', role.badgeColor)}>
                  {role.badge}
                </span>
              )}
                <p className="text-base text-muted-foreground leading-relaxed line-clamp-5">
                  {role.description}
                </p>
              </div>
              <Link
                href={role.href}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'border-white/20 hover:bg-white/5 w-full justify-center mt-auto text-xs h-8',
                )}
              >
                {role.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Secondary links */}
        <div className="flex items-center justify-around text-sm border-t border-white/10 pt-5 mb-5 rainbow-text">
          <span className="text-center">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4 transition-colors">
              Sign in
            </Link>
          </span>
          <span className="opacity-30">·</span>
          <Link href="/about" className="text-center underline underline-offset-4 transition-colors">
            Learn how it works
          </Link>
        </div>

        {/* Quick-nav buttons */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Browse Collections', href: '/browse' },
            { label: 'Browse Artists',     href: '/browse' },
            { label: 'Browse Curations',   href: '/ordinals' },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'border border-white/10 hover:border-white/25 hover:bg-white/5 rainbow-text transition-all text-xs h-9 rounded-lg',
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Right column — featured collection ──────────────────────────── */}
      {featured ? (
        <Link
          href={`/c/${featured.artist?.username ?? ''}/${featured.slug}`}
          className="relative lg:flex-1 h-72 lg:h-auto group block overflow-hidden"
        >
          {/* Full-bleed image */}
          {featured.cover_image_url ? (
            <Image
              src={featured.cover_image_url}
              alt={featured.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#c4b0ff]/20 via-[#ffb3d1]/10 to-[#b3f0c8]/15" />
          )}

          {/* Gradient overlay so text is readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Caption pinned to bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-8">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">
              Featured · {featured.artist?.stage_name ?? 'Artist'}
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-1 group-hover:text-[#c4b0ff] transition-colors">
              {featured.title}
            </h2>
            {featured.description && (
              <p className="text-sm text-white/60 leading-relaxed line-clamp-2 mb-3 max-w-md">
                {featured.description}
              </p>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
              {featured.piece_count} {featured.piece_count === 1 ? 'piece' : 'pieces'}
              <span className="text-white/30">·</span>
              <span className="text-white/70 group-hover:text-white transition-colors">View collection →</span>
            </span>
          </div>
        </Link>
      ) : (
        /* Fallback gradient panel when no featured collection is set */
        <div className="relative lg:flex-1 h-72 lg:h-auto overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#c4b0ff]/15 via-[#ffb3d1]/10 to-[#b3f0c8]/10" />
          <div className="absolute inset-0 flex items-end p-8">
            <p className="text-sm text-white/30">No featured collection set</p>
          </div>
        </div>
      )}
    </div>
  )
}
