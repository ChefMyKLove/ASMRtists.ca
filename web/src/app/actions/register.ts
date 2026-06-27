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
      status: 'active',
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

export async function addCuratorRole(
  userId: string,
  orgName: string,
  bio: string | null,
  website: string | null,
  tier: string,
  activate = true, // false for paid tiers — stays pending until Stripe webhook confirms payment
) {
  const supabase = createAdminClient()

  const status = activate ? 'active' : 'pending'

  const { error: profileError } = await supabase
    .from('curator_profiles')
    .upsert(
      { user_id: userId, organization: orgName, bio, website, tier, status },
      { onConflict: 'user_id' }
    )

  if (profileError) return { error: profileError.message }

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'curator', status }, { onConflict: 'user_id,role' })

  if (roleError) return { error: roleError.message }

  // Only flip active_role immediately for free tier — paid tiers activate via Stripe webhook
  if (activate) {
    const { error: activeRoleError } = await supabase
      .from('profiles')
      .update({ active_role: 'curator' })
      .eq('id', userId)
    if (activeRoleError) return { error: activeRoleError.message }
  }

  return { error: null }
}

export async function addCollectorRole(userId: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'collector', status: 'active' }, { onConflict: 'user_id,role' })

  if (error) return { error: error.message }
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
