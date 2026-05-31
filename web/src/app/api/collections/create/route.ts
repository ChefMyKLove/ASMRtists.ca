import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ArtworkInput {
  position: number
  storage_path: string
  filename: string
  width_px?: number
  height_px?: number
}

interface CreateCollectionBody {
  title: string
  description?: string
  tags?: string[]
  artworks: ArtworkInput[]
}

/**
 * POST /api/collections/create
 *
 * Authenticated. Artist-only.
 * Creates a collection + artwork rows after client-side upload to Supabase Storage.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check — must be artist or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'artist' && profile.role !== 'admin')) {
    return NextResponse.json(
      { error: 'Only artists can create collections' },
      { status: 403 }
    )
  }

  // Parse body
  let body: CreateCollectionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, description, tags, artworks } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (!Array.isArray(artworks) || artworks.length === 0) {
    return NextResponse.json({ error: 'artworks array is required and must not be empty' }, { status: 400 })
  }

  // Create collection row
  const { data: collection, error: collError } = await supabase
    .from('collections')
    .insert({
      artist_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      tags: Array.isArray(tags) ? tags : [],
      status: 'pending_review',
      piece_count: 0,
    })
    .select('id')
    .single()

  if (collError || !collection) {
    return NextResponse.json(
      { error: `Failed to create collection: ${collError?.message}` },
      { status: 500 }
    )
  }

  const collectionId = collection.id

  // Create artwork rows
  const artworkInserts = artworks.map((a) => ({
    collection_id: collectionId,
    artist_id: user.id,
    title: a.filename.replace(/\.[^.]+$/, ''),
    position: a.position,
    storage_path: a.storage_path,
    status: 'uploaded' as const,
    width_px: a.width_px ?? null,
    height_px: a.height_px ?? null,
  }))

  const { error: artworkError } = await supabase.from('artwork').insert(artworkInserts)

  if (artworkError) {
    // Clean up the orphaned collection
    await supabase.from('collections').delete().eq('id', collectionId)
    return NextResponse.json(
      { error: `Failed to create artwork records: ${artworkError.message}` },
      { status: 500 }
    )
  }

  // Update piece_count
  await supabase
    .from('collections')
    .update({ piece_count: artworks.length })
    .eq('id', collectionId)

  return NextResponse.json({ collection_id: collectionId }, { status: 201 })
}
