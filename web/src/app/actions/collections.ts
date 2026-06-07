'use server'

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

  const { error } = await admin
    .from('collections')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', collectionId)
    .eq('artist_id', ap.id)

  if (error) return { error: error.message }
  return { error: null }
}
