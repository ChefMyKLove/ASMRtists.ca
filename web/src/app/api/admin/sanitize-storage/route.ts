import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function needsSanitizing(path: string): boolean {
  const filename = path.split('/').pop() ?? ''
  return filename !== sanitize(filename)
}

export async function POST() {
  // Admin-only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('active_role')
    .eq('id', user.id)
    .single()

  if (profile?.active_role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all artwork rows with a storage_path
  const { data: artworks, error: fetchErr } = await admin
    .from('artwork')
    .select('id, storage_path, collection_id')
    .not('storage_path', 'is', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const dirty = (artworks ?? []).filter((a) => needsSanitizing(a.storage_path as string))

  if (dirty.length === 0) {
    return NextResponse.json({ message: 'Nothing to sanitize', moved: 0 })
  }

  const results: { id: string; old: string; new: string; status: string }[] = []

  for (const art of dirty) {
    const oldPath = art.storage_path as string
    const segments = oldPath.split('/')
    const sanitizedFilename = sanitize(segments[segments.length - 1])
    const newPath = [...segments.slice(0, -1), sanitizedFilename].join('/')

    // Move file in storage
    const { error: moveErr } = await admin.storage
      .from('artwork-originals')
      .move(oldPath, newPath)

    if (moveErr) {
      results.push({ id: art.id, old: oldPath, new: newPath, status: `move_failed: ${moveErr.message}` })
      continue
    }

    // Update artwork row
    await admin.from('artwork').update({ storage_path: newPath }).eq('id', art.id)

    results.push({ id: art.id, old: oldPath, new: newPath, status: 'ok' })
  }

  // Refresh cover_image_url for any collection where it pointed to an old path
  const oldToNew = new Map(results.filter(r => r.status === 'ok').map(r => [r.old, r.new]))

  const { data: collections } = await admin
    .from('collections')
    .select('id, cover_image_url')
    .not('cover_image_url', 'is', null)

  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const storagePrefix = `${supabaseBase}/storage/v1/object/public/artwork-originals/`

  for (const col of collections ?? []) {
    const cur = col.cover_image_url as string

    // Case 1: relative path stored directly
    if (oldToNew.has(cur)) {
      await admin.from('collections').update({ cover_image_url: oldToNew.get(cur) }).eq('id', col.id)
      continue
    }

    // Case 2: full URL stored — decode the path portion and compare
    if (cur.startsWith(storagePrefix)) {
      const pathPart = cur.slice(storagePrefix.length)
      let decodedPath: string
      try { decodedPath = decodeURIComponent(pathPart) } catch { decodedPath = pathPart }
      if (oldToNew.has(decodedPath)) {
        const newRelPath = oldToNew.get(decodedPath)!
        const newUrl = `${storagePrefix}${newRelPath.split('/').map(encodeURIComponent).join('/')}`
        await admin.from('collections').update({ cover_image_url: newUrl }).eq('id', col.id)
      }
    }
  }

  return NextResponse.json({ moved: results.filter(r => r.status === 'ok').length, results })
}
