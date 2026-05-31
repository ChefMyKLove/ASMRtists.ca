import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/leaderboard
 *
 * Public endpoint. Returns top artists, collectors, and curators.
 */
export async function GET() {
  const supabase = await createClient()

  // Top artists by total print sales (orders fulfilled)
  const { data: topArtists } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('role', 'artist')
    .order('created_at', { ascending: true })
    .limit(10)

  // Top collectors by ordinals held
  // TODO: join with ordinals table once it exists
  const { data: topCollectors } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('role', 'collector')
    .order('created_at', { ascending: true })
    .limit(10)

  // Top curators by artist count
  const { data: topCurators } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('role', 'curator')
    .order('created_at', { ascending: true })
    .limit(10)

  return NextResponse.json({
    artists: topArtists ?? [],
    collectors: topCollectors ?? [],
    curators: topCurators ?? [],
  })
}
