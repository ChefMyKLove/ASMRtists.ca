import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address } = body

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only the public address is stored — never the mnemonic or WIF
    const { error } = await supabase.from('wallets').upsert(
      {
        user_id: user.id,
        address,
        public_key: address,
        is_external: false,
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('wallet upsert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('save-address error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
