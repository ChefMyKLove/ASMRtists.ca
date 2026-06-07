import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HeroCarousel } from '@/components/splash/hero-carousel'
import { SaleTicker } from '@/components/splash/sale-ticker'
import { ArtistCard } from '@/components/gallery/artist-card'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'ASMRtists.ca — Blockchain Art Marketplace',
  description:
    'Discover independent artists. Own verifiable digital originals as BSV ordinals. Order museum-quality prints shipped worldwide.',
}

// TODO: Replace with supabase.from('sale_events').select('*').order('created_at', { ascending: false }).limit(8)
const recentSales = [
  { id: '1', artistName: 'Aurora Vex',    artworkTitle: 'Chromatic Drift No. 4', amount: '$120 CAD', timeAgo: '2 min ago' },
  { id: '2', artistName: 'Lunar Press',   artworkTitle: 'Pastel Void',           amount: '$85 CAD',  timeAgo: '18 min ago' },
  { id: '3', artistName: 'Neon Moth',     artworkTitle: 'Signal & Noise',        amount: '$95 CAD',  timeAgo: '34 min ago' },
  { id: '4', artistName: 'Verdant Echo',  artworkTitle: 'Mossy Cathedral',       amount: '$210 CAD', timeAgo: '1 hr ago' },
]

const placeholderArtists = [
  {
    slug: 'aurora-vex',
    displayName: 'Aurora Vex',
    bio: 'Digital surrealist exploring the boundaries between sound and colour.',
    artworkCount: 12,
    isFeatured: true,
    bannerUrl: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  },
  {
    slug: 'neon-moth',
    displayName: 'Neon Moth',
    bio: 'Generative art grounded in BSV blockchain inscription.',
    artworkCount: 8,
    bannerUrl: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=200&q=80',
  },
  {
    slug: 'lunar-press',
    displayName: 'Lunar Press',
    bio: 'Fine art prints with a pastel, dreamlike quality.',
    artworkCount: 24,
    bannerUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80',
  },
]

const valueProps = [
  { title: 'Own the Ordinal',
    body: 'Every artwork is inscribed as a BSV ordinal. You receive permanent, verifiable provenance on-chain — no one can take it from you.',
    icon: '◆',
  },
  {
    title: 'Print on Demand',
    body: 'Order museum-quality giclée prints and canvas wraps fulfilled by ASMRprints.com and shipped worldwide.',
    icon: '◎',
  },
  {
    title: 'Artists Get Paid',
    body: 'Revenue splits automatically via MNEE stablecoin and Stripe Connect — no middlemen, no 30-day waits.',
    icon: '◈',
  },
]

function storageUrl(supabaseUrl: string, path: string) {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/public/artwork-originals/${encoded}`
}

async function getChefData() {
  const admin = createAdminClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url, banner_url')
    .ilike('username', 'chefmyklove')
    .maybeSingle()

  if (!profile) return null

  const { data: artist } = await admin
    .from('artist_profiles')
    .select('id, stage_name, bio, avatar_url, banner_url, piece_count')
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!artist) return null

  const { data: collection } = await admin
    .from('collections')
    .select('id, title, description, slug, piece_count')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: artworks } = collection
    ? await admin
        .from('artwork')
        .select('id, title, storage_path')
        .eq('collection_id', collection.id)
        .order('position')
        .limit(8)
    : { data: [] }

  const artworkUrls = (artworks ?? [])
    .filter((a) => a.storage_path)
    .map((a) => storageUrl(supabaseUrl, a.storage_path))

  // Count actual uploaded artworks — artist_profiles.piece_count is not kept in sync
  const { count: actualCount } = collection
    ? await admin
        .from('artwork')
        .select('id', { count: 'exact', head: true })
        .eq('collection_id', collection.id)
    : { count: 0 }

  return {
    displayName: artist.stage_name ?? profile.display_name ?? 'chefmyklove',
    bio: artist.bio ?? 'Bold, expressive art that hits like a great meal — unforgettable and made with love.',
    avatarUrl: (artist.avatar_url ?? profile.avatar_url) as string | null,
    bannerUrl: (artist.banner_url ?? profile.banner_url ?? artworkUrls[0] ?? null) as string | null,
    pieceCount: actualCount ?? collection?.piece_count ?? 0,
    collection: collection
      ? {
          title: collection.title as string,
          description: (collection.description ?? 'Whimsical light refractions captured and manipulated by hand, never AI to give you Volume One. 64 distinct and beautiful pieces of whimsy.') as string,
          slug: collection.slug as string,
          pieceCount: (collection.piece_count ?? 0) as number,
        }
      : null,
    artworkUrls,
  }
}

export default async function SplashPage() {
  const chef = await getChefData()

  // ── Hero carousel ───────────────────────────────────────────────────────────
  // Replace the chefmyklove placeholder slides with real artwork images;
  // fall back to the Unsplash placeholder if we have no real images yet.
  const chefImg0 = chef?.artworkUrls[0] ?? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80'
  const chefImg1 = chef?.artworkUrls[1] ?? chefImg0
  const chefImg2 = chef?.artworkUrls[2] ?? chefImg0
  const chefImg3 = chef?.artworkUrls[3] ?? chefImg1
  const chefImg4 = chef?.artworkUrls[4] ?? chefImg0

  const featuredSlides = [
    {
      id: '1',
      imageUrl: chefImg0,
      artistName: chef?.displayName ?? 'chefmyklove',
      artworkTitle: 'Art made only when you want it.',
      artistSlug: 'chefmyklove',
      audienceTag: 'For Collectors',
      subhead: 'Art made only when you want it.',
      body: 'Fine-art paper, poster, canvas — from a growing roster of independent artists. Every piece is printed on demand, made to order, shipped worldwide. Find what belongs on your wall.',
    },
    {
      id: '2',
      imageUrl: chefImg1,
      artistName: chef?.displayName ?? 'chefmyklove',
      artworkTitle: 'Signal & Noise',
      artistSlug: 'chefmyklove',
      audienceTag: 'For Ordinal Collectors',
      subhead: 'Own the Ordinal. Hold the stake.',
      body: 'Every artwork is inscribed as a Bitcoin ordinal. You receive permanent, on-chain provenance — a verifiable claim to rewards as the artist grows. As their reputation rises, so does yours.',
      glyphType: 'bsv' as const,
    },
    {
      id: '3',
      imageUrl: chefImg2,
      artistName: chef?.displayName ?? 'chefmyklove',
      artworkTitle: 'Original Work',
      artistSlug: 'chefmyklove',
      audienceTag: 'For Artists',
      subhead: 'Your collectors are your marketing team!',
      body: "When someone buys your ordinal, they hold a verifiable on-chain stake in your work — your growth is their imperative. They're naturally incentivised to promote you. You get paid automatically on every sale — Stripe handles the payouts, Shopify runs the storefront. No chasing invoices. Everyone wins.",
    },
    {
      id: '4',
      imageUrl: chefImg3,
      artistName: chef?.displayName ?? 'chefmyklove',
      artworkTitle: 'Curated Works',
      artistSlug: 'chefmyklove',
      audienceTag: 'For Curators',
      subhead: 'Shape what the world collects next.',
      body: "Discover artists early, build collections with provenance, and earn a share of every sale you facilitate. Curation isn't just taste here — it's a role with real weight and real reward.",
      duration: 9000,
    },
    {
      id: '5',
      imageUrl: chefImg4,
      artistName: chef?.displayName ?? 'chefmyklove',
      artworkTitle: 'Featured Work',
      artistSlug: 'chefmyklove',
      audienceTag: 'Featured Artist',
      subhead: 'Flavor meets vision.',
      body: `${chef?.displayName ?? 'chefmyklove'} brings a bold, expressive energy to every canvas — art that moves through you the same way great food does. Discover their work and own a piece of something real.`,
    },
  ]

  // ── Featured artists ────────────────────────────────────────────────────────
  const chefArtistCard = {
    slug: 'chefmyklove',
    displayName: chef?.displayName ?? 'chefmyklove',
    bio: chef?.bio ?? 'Bold, expressive art that hits like a great meal — unforgettable and made with love.',
    artworkCount: chef?.pieceCount ?? 1,
    isFeatured: true,
    bannerUrl: chef?.bannerUrl ?? chefImg0,
    avatarUrl: chef?.avatarUrl ?? null,
  }

  const featuredArtists = [chefArtistCard, ...placeholderArtists]

  // ── Featured collections ────────────────────────────────────────────────────
  const collectionData = chef?.collection ?? {
    title: 'Ordinal Rainbows',
    description: 'Whimsical light refractions captured and manipulated by hand, never AI to give you Volume One. 64 distinct and beautiful pieces of whimsy.',
    slug: 'ordinalrainbows',
    pieceCount: 0,
  }

  // Fill up to 4 slots — real images first, then a gradient placeholder
  const artworkImageSlots = Array.from({ length: 4 }, (_, i) => chef?.artworkUrls[i] ?? null)

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">

        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="aurora-orb aurora-orb-1" />
          <div className="aurora-orb aurora-orb-2" />
          <div className="aurora-orb aurora-orb-3" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-center">

            {/* Left column */}
            <div className="space-y-8">

              <div className="animate-wipe inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                style={{ '--wipe-delay': '0ms' } as React.CSSProperties}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live marketplace · BSV Ordinals
              </div>

              <h1
                className="animate-wipe font-display text-6xl sm:text-7xl lg:text-[88px] font-light leading-[0.95] tracking-tight"
                style={{ '--wipe-delay': '80ms' } as React.CSSProperties}
              >
                Art that lives<br />
                <span className="rainbow-text italic">on-chain</span><br />
                and in your<br />
                hands.
              </h1>

              <p
                className="animate-wipe text-base sm:text-lg text-muted-foreground leading-relaxed max-w-md"
                style={{ '--wipe-delay': '220ms' } as React.CSSProperties}
              >
                Discover independent artists. Own verifiable digital originals as BSV ordinals.
                Order museum-quality prints — all in one place.
              </p>

              <div
                className="animate-wipe flex flex-wrap gap-3"
                style={{ '--wipe-delay': '320ms' } as React.CSSProperties}
              >
                <Link href="/browse" className={cn(buttonVariants({ size: 'lg' }), 'bg-white text-black hover:bg-white/90 font-semibold rounded-none')}>
                  Browse Art
                </Link>
                <Link href="/get-started" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'border-white/20 hover:bg-white/5 rounded-none')}>
                  Sell Your Work
                </Link>
                <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'text-white/70 hover:text-white rounded-none')}>
                  Sign In
                </Link>
              </div>

              <div
                className="animate-wipe flex gap-10 pt-2 border-t border-white/10"
                style={{ '--wipe-delay': '420ms' } as React.CSSProperties}
              >
                {[
                  { label: 'Artists', value: '200+' },
                  { label: 'Artworks', value: '1,400+' },
                  { label: 'Ordinals minted', value: '380+' },
                ].map((stat) => (
                  <div key={stat.label} className="pt-5">
                    <p className="text-3xl font-light text-[#c4b0ff]">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — carousel */}
            <div className="animate-wipe" style={{ '--wipe-delay': '120ms' } as React.CSSProperties}>
              <HeroCarousel slides={featuredSlides} />
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto">
          <SaleTicker sales={recentSales} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-24 py-20">

        {/* ── Featured Artists ────────────────────────────────────── */}
        <div>
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Curated Roster</p>
              <h2 className="font-display text-4xl sm:text-5xl font-light">Featured Artists</h2>
            </div>
            <Link href="/browse" className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredArtists.map((artist) => (
              <ArtistCard key={artist.slug} {...artist} />
            ))}
          </div>
        </div>

        {/* ── Featured Collections ─────────────────────────────────── */}
        <div>
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Curated Works</p>
              <h2 className="font-display text-4xl sm:text-5xl font-light">Featured Collections</h2>
            </div>
            <Link href="/browse" className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Link
              href={`/c/chefmyklove/${collectionData.slug}`}
              className="group glass rounded-xl overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200"
            >
              {/* 2×2 artwork grid */}
              <div className="grid grid-cols-2 gap-px bg-white/5">
                {artworkImageSlots.map((imgUrl, i) =>
                  imgUrl ? (
                    <div key={i} className="relative aspect-square overflow-hidden">
                      <Image
                        src={imgUrl}
                        alt={`${collectionData.title} piece ${i + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 280px"
                      />
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="aspect-square"
                      style={{
                        background: `linear-gradient(135deg,
                          hsl(${260 + i * 30} 60% 20%) 0%,
                          hsl(${290 + i * 30} 50% 15%) 100%)`,
                      }}
                    />
                  )
                )}
              </div>
              {/* Card footer */}
              <div className="p-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm group-hover:text-white transition-colors truncate">
                      {collectionData.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {chefArtistCard.displayName} · {collectionData.pieceCount} pieces
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-white transition-colors">
                    View →
                  </span>
                </div>
                {collectionData.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 pt-1">
                    {collectionData.description}
                  </p>
                )}
              </div>
            </Link>
          </div>
        </div>

        {/* ── Value props ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/5">
          {valueProps.map((prop, i) => {
            const accents = ['#c4b0ff', '#ffb3d1', '#b3f0c8']
            return (
              <div key={prop.title} className="bg-background p-8 space-y-4 group hover:bg-white/[0.03] transition-colors">
                <span className="text-3xl" style={{ color: accents[i] }}>{prop.icon}</span>
                <h3 className="font-display text-2xl font-light">{prop.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{prop.body}</p>
              </div>
            )
          })}
        </div>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-none p-12 sm:p-16 text-center space-y-6"
          style={{
            background: 'linear-gradient(135deg, rgba(196,176,255,0.12) 0%, rgba(255,179,209,0.08) 50%, rgba(163,230,196,0.10) 100%)',
            border: '1px solid rgba(196,176,255,0.15)',
          }}
        >
          <div aria-hidden className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#c4b0ff]/10 blur-[60px] pointer-events-none" />
          <div aria-hidden className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-[#ffb3d1]/10 blur-[50px] pointer-events-none" />
          <p className="relative text-xs uppercase tracking-[0.3em] text-muted-foreground">Join the platform</p>
          <h2 className="relative font-display text-3xl sm:text-4xl font-light">
            Ready to be part of something new?
          </h2>
          <p className="relative text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
            Join as an artist, curator, or collector — it takes less than two minutes.
          </p>
          <div className="relative flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/get-started"
              className={cn(buttonVariants({ size: 'lg' }), 'bg-white text-black hover:bg-white/90 font-semibold rounded-none')}
            >
              Create your profile
            </Link>
            <Link
              href="/about"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'border-white/20 hover:bg-white/5 rounded-none')}
            >
              Learn how it works
            </Link>
          </div>
        </div>

      </div>
    </>
  )
}
