'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function saveBsvAddressAction(
  address: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // wallets table — upsert the user's Primary wallet
  const { data: existing } = await admin
    .from('wallets')
    .select('id')
    .eq('user_id', user.id)
    .eq('label', 'Primary')
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('wallets')
      .update({ address })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('wallets')
      .insert({
        user_id: user.id,
        address,
        public_key: address,   // placeholder — not available from browser wallets
        is_external: true,
        label: 'Primary',
      })
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/profile')
  return { error: null }
}

export async function saveOrdAddressAction(
  ordAddress: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('wallets')
    .select('id')
    .eq('user_id', user.id)
    .eq('label', 'Ordinals')
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('wallets')
      .update({ address: ordAddress })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await admin
      .from('wallets')
      .insert({
        user_id: user.id,
        address: ordAddress,
        public_key: ordAddress,
        is_external: true,
        label: 'Ordinals',
      })
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/profile')
  return { error: null }
}

export async function updateProfileAction(data: {
  display_name?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  social_links?: Record<string, string>
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/profile')
  return { error: null }
}

export async function updateArtistProfileAction(data: {
  stage_name?: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  location?: string
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Not authenticated' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('artist_profiles')
    .update(data)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/profile')
  return { error: null }
}
