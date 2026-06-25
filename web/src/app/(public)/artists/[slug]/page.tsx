import type { Metadata } from 'next'

export const revalidate = 300

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ArtistPageClient } from './artist-page-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { artworkStorageUrl } from '@/lib/utils'

interface ArtistPageProps {
  params: Promise<{ slug: string }>
}

function getStorageUrl(path: string | null): string {
  return artworkStorageUrl(path) ?? ''
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, bio')
    .eq('username', slug)
    .maybeSingle()

  const displayName = profile?.display_name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    title: `${displayName} — ASMRtists.ca`,
    description: profile?.bio ?? `Discover the art of ${displayName} on ASMRtists.ca. Buy prints or earn rewards by holding a BSV ordinal of a popular artwork.`,
  }
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  // 1. Find profile by username (slug)
  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, banner_url, social_links')
    .eq('username', slug)
    .maybeSingle()

  if (!profile) notFound()

  // 2. Find artist profile (may not exist yet)
  const { data: artistProfile } = await admin
    .from('artist_profiles')
    .select('id, stage_name, bio, avatar_url, banner_url, status, piece_count, location')
    .eq('user_id', profile.id)
    .maybeSingle()

  // 3. Get active collections + artwork
  const { data: collections } = artistProfile
    ? await admin
        .from('collections')
        .select('id, title, slug, cover_image_url, artwork(id, title, description, storage_path, thumbnail_url, inscription_txid, inscription_outpoint, status, print_products(shopify_product_handle, product_type))')
        .eq('artist_id', artistProfile.id)
        .in('status', ['active', 'pending_review'])
    : { data: [] }

  // 4. Map to ArtistPageClient types
  const artworks = (collections ?? []).flatMap((col) =>
    ((col.artwork ?? []) as {
      id: string
      title: string
      description: string | null
      storage_path: string | null
      thumbnail_url: string | null
      inscription_txid: string | null
      inscription_outpoint: string | null
      status: string
      print_products: { shopify_product_handle: string | null; product_type: string | null }[] | null
    }[]).filter((a) => a.status !== 'pending_review' && a.status !== 'rejected').map((a) => ({
      id: a.id,
      collectionSlug: col.slug as string,
      title: a.title,
      description: a.description ?? '',
      thumbnailUrl: a.thumbnail_url ?? getStorageUrl(a.storage_path),
      pricePrintCad: 0,
      priceOrdinalMnee: 0,
      printProducts: (a.print_products ?? [])
        .filter((p) => p.shopify_product_handle)
        .map((p) => ({ handle: p.shopify_product_handle!, productType: p.product_type ?? 'print' })),
      inscriptionId: a.inscription_txid ?? undefined,
      inscriptionOutpoint: a.inscription_outpoint ?? undefined,
      isOrdinal: !!a.inscription_txid,
    }))
  )

  const ordinals = artworks
    .filter((a) => a.isOrdinal)
    .map((a) => {
      const outpoint = a.inscriptionOutpoint ?? (a.inscriptionId ? `${a.inscriptionId}_0` : null)
      return outpoint ? {
        id: a.id,
        title: a.title,
        thumbnailUrl: a.thumbnailUrl,
        inscriptionId: a.inscriptionId!,
        outpoint,
        collectionUrl: `/c/${slug}/${a.collectionSlug}`,
        rarity: 'common' as const,
        holderCount: 1,
      } : null
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)

  // Build collections for the Collections tab
  const collectionsForClient = (collections ?? []).map((col) => {
    const artworkList = (col.artwork ?? []) as {
      status: string
      storage_path: string | null
      thumbnail_url: string | null
    }[]
    const visibleArtworks = artworkList.filter(
      (a) => a.status !== 'pending_review' && a.status !== 'rejected'
    )
    const first = visibleArtworks[0]
    const coverImageUrl =
      getStorageUrl(col.cover_image_url as string | null) ||
      first?.thumbnail_url ||
      (first?.storage_path ? getStorageUrl(first.storage_path) : null)
    return {
      id: col.id as string,
      title: col.title as string,
      slug: col.slug as string,
      coverImageUrl,
      pieceCount: visibleArtworks.length,
    }
  })

  const socialLinks = (profile.social_links as Record<string, string> | null) ?? {}

  // Prefer artist_profile fields, fall back to profile fields
  const displayName = artistProfile?.stage_name ?? profile.display_name ?? slug
  const bio = artistProfile?.bio ?? profile.bio ?? ''
  const avatarUrl = artistProfile?.avatar_url ?? profile.avatar_url ?? ''
  const bannerUrl = artistProfile?.banner_url ?? profile.banner_url ?? artworks[0]?.thumbnailUrl ?? ''
  const location = (artistProfile as { location?: string | null } | null)?.location ?? null

  return (
    <div>
      {/* ── Banner ────────────────────────────────────────────── */}
      <div className="relative h-52 sm:h-64 bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40">
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
        {/* ── Profile header ────────────────────────────────────── */}
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
              <Badge variant="secondary" className="text-xs flex-shrink-0">Artist</Badge>
              {artistProfile?.status === 'active' && (
                <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-0 flex-shrink-0">
                  Verified
                </Badge>
              )}
            </div>
            {/* Social links */}
            <div className="flex gap-3 text-xs text-muted-foreground">
              {socialLinks.twitter && (
                <a
                  href={`https://twitter.com/${socialLinks.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  @{socialLinks.twitter}
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${socialLinks.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  ig/{socialLinks.instagram}
                </a>
              )}
              {socialLinks.website && (
                <a
                  href={socialLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  {socialLinks.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
            {location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {location}
              </p>
            )}
          </div>
        </div>

        {bio && (
          <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mb-8">
            {bio}
          </p>
        )}

        {/* ── Tabbed gallery — client component ─────────────────── */}
        <ArtistPageClient
          artworks={artworks}
          ordinals={ordinals}
          artistSlug={slug}
          collections={collectionsForClient}
        />
      </div>
    </div>
  )
}


