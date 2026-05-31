'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import sharp from 'sharp'

const JPEG_MAX_BYTES = 400 * 1024 // 400 KB

/**
 * Convert an artwork's original PNG to an inscription-optimised JPEG
 * and store it in the `artwork-jpegs` Supabase Storage bucket.
 *
 * Called by the artist dashboard "Prepare for Minting" button.
 * Idempotent — re-running when jpeg_storage_path is already set is a no-op.
 */
export async function prepareOrdinalAction(
  artworkId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const admin = createAdminClient()

  // Verify the caller is the owning artist
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) return { ok: false, error: 'No artist profile found' }

  const { data: art } = await admin
    .from('artwork')
    .select('id, storage_path, jpeg_storage_path')
    .eq('id', artworkId)
    .eq('artist_id', ap.id)
    .single()
  if (!art) return { ok: false, error: 'Artwork not found or access denied' }

  // Idempotent — already prepared
  if (art.jpeg_storage_path) return { ok: true }

  if (!art.storage_path) return { ok: false, error: 'No source image on record' }

  // Download original PNG from Supabase Storage
  const { data: fileData, error: dlErr } = await admin.storage
    .from('artwork-originals')
    .download(art.storage_path)
  if (dlErr || !fileData) {
    return { ok: false, error: `Download failed: ${dlErr?.message ?? 'unknown'}` }
  }

  // Convert PNG → JPEG, stepping quality down until under JPEG_MAX_BYTES
  const arrayBuffer = await fileData.arrayBuffer()
  let quality = 85
  let jpegBuffer: Buffer
  do {
    jpegBuffer = await sharp(Buffer.from(arrayBuffer))
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    quality -= 5
  } while (jpegBuffer.length > JPEG_MAX_BYTES && quality >= 50)

  // Upload to artwork-jpegs bucket (path mirrors the original, .jpg extension)
  const jpegPath = art.storage_path.replace(/\.[^.]+$/, '.jpg')
  const { error: uploadErr } = await admin.storage
    .from('artwork-jpegs')
    .upload(jpegPath, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })
  if (uploadErr) {
    return { ok: false, error: `Upload failed: ${uploadErr.message}` }
  }

  // Persist jpeg_storage_path
  const { error: dbErr } = await admin
    .from('artwork')
    .update({ jpeg_storage_path: jpegPath })
    .eq('id', artworkId)
  if (dbErr) {
    return { ok: false, error: `DB update failed: ${dbErr.message}` }
  }

  return { ok: true }
}
