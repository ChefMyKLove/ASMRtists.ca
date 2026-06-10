'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function createArtistProfile(
  userId: string,
  stageName: string,
  bio: string | null,
  location: string | null,
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('artist_profiles')
    .insert({
      user_id: userId,
      stage_name: stageName,
      bio,
      location,
      status: 'pending',
    })

  if (error) return { error: error.message }

  const { error: roleError } = await supabase
    .from('profiles')
    .update({ active_role: 'artist' })
    .eq('id', userId)

  if (roleError) return { error: roleError.message }

  await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'artist', status: 'active' }, { onConflict: 'user_id,role' })

  return { error: null }
}

export async function saveWalletAddress(
  userId: string,
  address: string,
  ordAddress?: string,
  isExternal = false,
) {
  const supabase = createAdminClient()

  const rows = [
    { user_id: userId, address, public_key: address, is_external: isExternal, label: 'Primary' },
  ]

  // Save a separate ordinals address row when it differs from the payment address
  if (ordAddress && ordAddress !== address) {
    rows.push({ user_id: userId, address: ordAddress, public_key: ordAddress, is_external: isExternal, label: 'Ordinals' })
  }

  const { error } = await supabase.from('wallets').insert(rows)
  if (error) return { error: error.message }
  return { error: null }
}
