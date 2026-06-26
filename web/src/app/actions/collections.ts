'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** Alphanumeric slug only — matches schema: "lowercase, alphanumeric only, no hyphens" */
function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'untitled'
}

export async function createCollectionAction(
  title: string,
  description: string | null,
  tags: string[],
): Promise<{
  collectionId: string | null
  artistProfileId: string | null
  userId: string | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { collectionId: null, artistProfileId: null, userId: null, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: ap, error: apErr } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (apErr || !ap) {
    return { collectionId: null, artistProfileId: null, userId: null, error: 'Artist profile not found. Complete registration first.' }
  }

  // Unique slug: alphanumeric base + 4-char timestamp suffix
  const slug = `${toSlug(title)}${Date.now().toString(36).slice(-4)}`

  const { data: collection, error: collErr } = await admin
    .from('collections')
    .insert({ artist_id: ap.id, title, description, tags, slug, status: 'draft', piece_count: 0 })
    .select('id')
    .single()

  if (collErr || !collection) {
    return { collectionId: null, artistProfileId: null, userId: null, error: collErr?.message ?? 'Failed to create collection' }
  }

  return { collectionId: collection.id, artistProfileId: ap.id, userId: user.id, error: null }
}

export async function insertArtworkAction(
  collectionId: string,
  artistProfileId: string,
  title: string,
  storagePath: string,
  widthPx: number | null,
  heightPx: number | null,
  ordinalPriceMnee: number | null = null,
): Promise<{ id: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { id: null, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: maxRow } = await admin
    .from('artwork')
    .select('position')
    .eq('collection_id', collectionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const position = (maxRow?.position ?? 0) + 1

  const { data, error } = await admin
    .from('artwork')
    .insert({
      collection_id: collectionId,
      artist_id: artistProfileId,
      title,
      position,
      storage_path: storagePath,
      status: 'uploaded',
      width_px: widthPx,
      height_px: heightPx,
      ordinal_price_mnee: ordinalPriceMnee,
    })
    .select('id')
    .single()

  if (error || !data) return { id: null, error: error?.message ?? 'Failed to insert artwork' }
  return { id: data.id, error: null }
}

export async function finalizeCollectionAction(
  collectionId: string,
  pieceCount: number,
): Promise<{ error: string | null }> {
  if (pieceCount === 0) return { error: null }

  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('collections')
    .update({ piece_count: pieceCount, status: 'pending_review' })
    .eq('id', collectionId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function getCollectionForUploadAction(
  collectionId: string,
): Promise<{
  title: string | null
  artistProfileId: string | null
  userId: string | null
  pieceCount: number
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { title: null, artistProfileId: null, userId: null, pieceCount: 0, error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: ap, error: apErr } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (apErr || !ap) return { title: null, artistProfileId: null, userId: null, pieceCount: 0, error: 'Artist profile not found' }

  const { data: collection, error: collErr } = await admin
    .from('collections')
    .select('title, piece_count')
    .eq('id', collectionId)
    .eq('artist_id', ap.id)
    .single()

  if (collErr || !collection) {
    return { title: null, artistProfileId: null, userId: null, pieceCount: 0, error: 'Collection not found or not owned by you' }
  }

  return { title: collection.title, artistProfileId: ap.id, userId: user.id, pieceCount: collection.piece_count, error: null }
}

export async function updateArtworkMetadataAction(
  artworkId: string,
  title: string,
  subtitle: string | null,
  inscriptionTxid: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Verify ownership via artist_profiles
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) return { error: 'Artist profile not found' }

  const { error } = await admin
    .from('artwork')
    .update({ title, subtitle: subtitle || null, inscription_txid: inscriptionTxid || null })
    .eq('id', artworkId)
    .eq('artist_id', ap.id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function updateCollectionPieceCountAction(
  collectionId: string,
  newCount: number,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('collections')
    .update({ piece_count: newCount })
    .eq('id', collectionId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function updateCollectionDescriptionAction(
  collectionId: string,
  description: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) return { error: 'Artist profile not found' }

  const { error } = await admin
    .from('collections')
    .update({ description: description || null })
    .eq('id', collectionId)
    .eq('artist_id', ap.id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function approveArtworkAction(
  artworkId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.active_role !== 'curator' && profile.active_role !== 'admin')) {
    return { error: 'Not authorized' }
  }

  const { error } = await admin
    .from('artwork')
    .update({ status: 'uploaded' })
    .eq('id', artworkId)

  if (error) return { error: error.message }

  // Fire pipeline trigger (best effort — artwork is approved regardless)
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    await fetch(`${baseUrl}/api/pipeline/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-secret': process.env.PIPELINE_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ artworkId }),
    })
  } catch {
    // Non-fatal — pipeline will pick it up on its next scheduled run
  }

  return { error: null }
}

export async function rejectArtworkAction(
  artworkId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.active_role !== 'curator' && profile.active_role !== 'admin')) {
    return { error: 'Not authorized' }
  }

  const { error } = await admin
    .from('artwork')
    .update({ status: 'rejected' })
    .eq('id', artworkId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function setCollectionCoverImageAction(
  collectionId: string,
  coverImageUrl: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Verify ownership via artist_profiles
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) return { error: 'Artist profile not found' }

  const { data: updated, error } = await admin
    .from('collections')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', collectionId)
    .eq('artist_id', ap.id)
    .select('id')

  if (error) return { error: error.message }
  if (!updated?.length) return { error: 'Collection not found or not owned by this artist' }

  revalidatePath(`/dashboard/collections/${collectionId}`)
  revalidatePath('/')
  return { error: null }
}

// ─── Admin actions ────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()
  if (profile?.active_role !== 'admin') return { error: 'Not authorized' }
  return { userId: user.id }
}

export interface AdminPendingCollection {
  id: string
  title: string
  piece_count: number
  created_at: string
  artist_name: string | null
}

export async function getAdminPendingCollectionsAction(): Promise<{
  collections: AdminPendingCollection[]
  error: string | null
}> {
  const auth = await requireAdmin()
  if ('error' in auth) return { collections: [], error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('collections')
    .select('id, title, piece_count, created_at, artist_id')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) return { collections: [], error: error.message }

  // Resolve artist names via artist_profiles → profiles
  const collections = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: ap } = await admin
        .from('artist_profiles')
        .select('user_id, stage_name')
        .eq('id', row.artist_id)
        .single()

      let artist_name = ap?.stage_name ?? null
      if (!artist_name && ap?.user_id) {
        const { data: profile } = await admin
          .from('profiles')
          .select('display_name')
          .eq('id', ap.user_id)
          .single()
        artist_name = profile?.display_name ?? null
      }

      return {
        id: row.id,
        title: row.title,
        piece_count: row.piece_count,
        created_at: row.created_at,
        artist_name,
      }
    })
  )

  return { collections, error: null }
}

export async function adminApproveCollectionAction(
  collectionId: string,
): Promise<{ error: string | null }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()

  // Fetch collection to get artist_id before updating
  const { data: collection } = await admin
    .from('collections')
    .select('artist_id')
    .eq('id', collectionId)
    .single()

  const { error } = await admin
    .from('collections')
    .update({ status: 'active' })
    .eq('id', collectionId)

  if (error) return { error: error.message }

  // Activate the artist profile so they appear in browse
  if (collection?.artist_id) {
    await admin
      .from('artist_profiles')
      .update({ status: 'active' })
      .eq('id', collection.artist_id)
  }

  // Fire pipeline for all uploaded artworks
  const { data: artworks } = await admin
    .from('artwork')
    .select('id')
    .eq('collection_id', collectionId)
    .eq('status', 'uploaded')

  if (artworks && artworks.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    await Promise.allSettled(
      artworks.map((aw) =>
        fetch(`${baseUrl}/api/pipeline/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-pipeline-secret': process.env.PIPELINE_WEBHOOK_SECRET ?? '',
          },
          body: JSON.stringify({ artworkId: aw.id }),
        })
      )
    )
  }

  revalidatePath('/browse')
  revalidatePath('/')

  return { error: null }
}

export async function adminRejectCollectionAction(
  collectionId: string,
): Promise<{ error: string | null }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('collections')
    .update({ status: 'archived' })
    .eq('id', collectionId)

  if (error) return { error: error.message }
  return { error: null }
}
