import type { Metadata } from 'next'

export const revalidate = 300

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchProductPrices } from '@/lib/shopify'
import { CollectionPageClient } from './collection-page-client'
import type { CollectionArtist, CollectionData } from '@/components/collection/types'

interface CollectionPageProps {
  params: Promise<{ username: string; collection: string }>
}

// ── Two-step artist lookup ──────────────────────────────────────────────────
// Uses admin client to bypass RLS — public collection pages must be readable
// by unauthenticated visitors.

async function lookupArtist(
  username: string,
): Promise<CollectionArtist | null> {
  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', username)
    .single()

  if (!profile) return null

  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id, bio, avatar_url, user_id, stage_name')
    .eq('user_id', profile.id)
    .single()

  if (!ap) return null

  return {
    id: ap.id as string,
    user_id: ap.user_id as string,
    username: profile.username as string,
    display_name: ((profile.display_name ?? ap.stage_name ?? username) as string),
    avatar_url: ((ap.avatar_url ?? profile.avatar_url ?? null) as string | null),
    bio: (ap.bio as string | null) ?? null,
  }
}

// ── generateMetadata ────────────────────────────────────────────────────────

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { username, collection: slug } = await params
  const admin = createAdminClient()

  const artist = await lookupArtist(username)
  if (!artist) return { title: 'Collection — ASMRtists.ca' }

  const { data: col } = await admin
    .from('collections')
    .select('title, description')
    .eq('artist_id', artist.id)
    .eq('slug', slug)
    .single()

  if (!col) return { title: 'Collection — ASMRtists.ca' }

  const title = col.title as string
  const description = (col.description as string | null) ?? `Explore ${title} on ASMRtists.ca`

  return {
    title: `${title} — ASMRtists.ca`,
    description,
    openGraph: {
      title: `${title} — ASMRtists.ca`,
      description,
    },
  }
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { username, collection: slug } = await params
  const admin = createAdminClient()

  // Step 1 — resolve artist (admin client bypasses RLS for public visibility)
  const artist = await lookupArtist(username)
  if (!artist) notFound()

  // Step 2 — collection by (artist_id, slug), with artwork + print_products nested
  const { data: col } = await admin
    .from('collections')
    .select(`
      id, slug, title, description, cover_image_url, status,
      artwork (
        id, position, title, description,
        storage_path, thumbnail_url, jpeg_storage_path,
        inscription_txid, inscription_outpoint, ordinal_metadata,
        print_products ( shopify_product_handle, product_type )
      )
    `)
    .eq('artist_id', artist.id)
    .eq('slug', slug)
    .single()

  if (!col) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isOwningArtist = user?.id === artist.user_id

  // Build thumbnail URLs — use stored thumbnail_url, else derive from storage_path
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const rawArtwork = col.artwork as Array<CollectionData['artwork'][number] & { storage_path: string | null }>
  const artworkWithThumbnails = rawArtwork.map((a) => ({
    ...a,
    thumbnail_url:
      a.thumbnail_url ??
      (a.storage_path
        ? `${supabaseUrl}/storage/v1/object/public/artwork-originals/${a.storage_path.split('/').map(encodeURIComponent).join('/')}`
        : null),
  }))

  // Fetch Shopify prices for all print products in this collection
  const handles = artworkWithThumbnails
    .flatMap((a) => (a.print_products ?? []).map((p) => p.shopify_product_handle))
    .filter((h): h is string => !!h)
  const priceMap = await fetchProductPrices(handles)

  const collection: CollectionData = {
    id: col.id as string,
    slug: col.slug as string,
    title: col.title as string,
    description: (col.description as string | null) ?? null,
    cover_image_url: (col.cover_image_url as string | null) ?? null,
    status: col.status as string,
    artwork: artworkWithThumbnails ?? [],
    artist,
  }

  return (
    <CollectionPageClient
      collection={collection}
      isOwningArtist={isOwningArtist}
      priceMap={priceMap}
    />
  )
}
