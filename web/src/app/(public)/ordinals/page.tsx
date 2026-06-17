import type { Metadata } from 'next'

export const revalidate = 300

import { createAdminClient } from '@/lib/supabase/admin'
import { OrdinalsClient } from './ordinals-client'

export const metadata: Metadata = {
  title: 'Ordinals Marketplace — ASMRtists.ca',
  description: 'Mint original BSV ordinals from council-approved artists, or buy listed ordinals from collectors.',
}

export type MintableItem = {
  id: string
  title: string
  description: string | null
  thumbnailUrl: string | null
  ordinal_price_mnee: number | null
  collection: { id: string; title: string; slug: string }
  artist: { username: string; displayName: string }
}

export type ListingItem = {
  id: string
  inscription_outpoint: string
  price_mnee: number
  seller_ord_address: string
  artwork: {
    id: string
    title: string
    thumbnailUrl: string | null
    collection: { title: string; slug: string }
    artist: { username: string; displayName: string }
  }
}

export type OwnableItem = {
  id: string
  title: string
  thumbnailUrl: string | null
  inscription_outpoint: string
  collection: { title: string; slug: string }
  artist: { username: string; displayName: string }
}

export default async function OrdinalsPage() {
  const admin = createAdminClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  function imgUrl(path: string | null): string | null {
    if (!path) return null
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    return `${supabaseUrl}/storage/v1/object/public/artwork-originals/${encoded}`
  }

  // ── Step 1: active (council-approved) collections with artist info ──────────
  const { data: activeCols } = await admin
    .from('collections')
    .select('id, title, slug, artist_profiles!inner(id, stage_name, user_id)')
    .eq('status', 'active')

  const colMap = new Map<string, { title: string; slug: string; artistProfileId: string; artistUserId: string }>()
  for (const c of activeCols ?? []) {
    const ap = (c.artist_profiles as any)
    colMap.set(c.id, {
      title: c.title,
      slug: c.slug,
      artistProfileId: ap.id,
      artistUserId: ap.user_id,
    })
  }

  const activeColIds = [...colMap.keys()]

  // ── Step 2: mintable artwork in active collections ──────────────────────────
  const { data: mintableRaw } = activeColIds.length > 0
    ? await admin
        .from('artwork')
        .select('id, title, description, jpeg_storage_path, storage_path, ordinal_price_mnee, collection_id')
        .not('jpeg_storage_path', 'is', null)
        .is('inscription_txid', null)
        .in('collection_id', activeColIds)
        .order('position')
        .limit(48)
    : { data: [] }

  // ── Step 3: artist usernames for all active collections ────────────────────
  const artistUserIds = [...new Set([...colMap.values()].map(c => c.artistUserId))]
  const { data: profilesRaw } = artistUserIds.length > 0
    ? await admin.from('profiles').select('id, username, display_name').in('id', artistUserIds)
    : { data: [] }

  const profileMap = new Map<string, { username: string; displayName: string }>()
  for (const p of profilesRaw ?? []) {
    profileMap.set(p.id, {
      username: p.username,
      displayName: (p.display_name ?? p.username) as string,
    })
  }

  // Assemble mintable items
  const mintable: MintableItem[] = (mintableRaw ?? []).map((a) => {
    const col = colMap.get(a.collection_id)!
    const profile = profileMap.get(col.artistUserId) ?? { username: '', displayName: 'Artist' }
    return {
      id: a.id,
      title: a.title,
      description: a.description as string | null,
      thumbnailUrl: imgUrl((a.jpeg_storage_path ?? a.storage_path) as string | null),
      ordinal_price_mnee: a.ordinal_price_mnee as number | null,
      collection: { id: a.collection_id, title: col.title, slug: col.slug },
      artist: profile,
    }
  })

  // ── Step 4: all minted artworks (for wallet-connect ownership detection) ───
  const { data: mintedRaw } = await admin
    .from('artwork')
    .select('id, title, storage_path, jpeg_storage_path, inscription_outpoint, collection_id')
    .not('inscription_outpoint', 'is', null)
    .limit(200)

  const ownableItems: OwnableItem[] = (mintedRaw ?? []).flatMap((a) => {
    if (!a.inscription_outpoint) return []
    const col = colMap.get(a.collection_id)
    const profile = col
      ? (profileMap.get(col.artistUserId) ?? { username: '', displayName: 'Artist' })
      : { username: '', displayName: 'Artist' }
    return [{
      id: a.id,
      title: a.title,
      thumbnailUrl: imgUrl((a.jpeg_storage_path ?? a.storage_path) as string | null),
      inscription_outpoint: a.inscription_outpoint as string,
      collection: { title: col?.title ?? '', slug: col?.slug ?? '' },
      artist: profile,
    }]
  })

  // ── Step 5: active resale listings ─────────────────────────────────────────
  let listings: ListingItem[] = []
  try {
    const { data: listingsRaw } = await admin
      .from('ordinal_listings')
      .select(`
        id, inscription_outpoint, price_mnee, seller_ord_address,
        artwork!inner(id, title, storage_path, jpeg_storage_path, collection_id)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(48)

    listings = (listingsRaw ?? []).map((l) => {
      const art = l.artwork as any
      const col = colMap.get(art.collection_id)
      const profile = col ? profileMap.get(col.artistUserId) : undefined
      return {
        id: l.id,
        inscription_outpoint: l.inscription_outpoint,
        price_mnee: Number(l.price_mnee),
        seller_ord_address: l.seller_ord_address,
        artwork: {
          id: art.id,
          title: art.title,
          thumbnailUrl: imgUrl(art.jpeg_storage_path ?? art.storage_path),
          collection: col
            ? { title: col.title, slug: col.slug }
            : { title: 'Unknown', slug: '' },
          artist: profile ?? { username: '', displayName: 'Artist' },
        },
      }
    })
  } catch {
    // ordinal_listings table may not exist yet — run v0.5.0 migration
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <OrdinalsClient mintable={mintable} listings={listings} ownableItems={ownableItems} />
    </div>
  )
}
