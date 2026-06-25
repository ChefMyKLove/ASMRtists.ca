import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getProduct } from '@/lib/printify/client'

export async function POST() {
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

  const { data: rows, error } = await admin
    .from('print_products')
    .select('id, printify_product_id, shopify_product_handle')
    .not('printify_product_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { id: string; handle: string | null; status: string }[] = []

  for (const row of rows ?? []) {
    if (!row.printify_product_id) continue
    try {
      const product = await getProduct(row.printify_product_id as string)
      const handle = product.external?.handle ?? null
      if (handle && handle !== row.shopify_product_handle) {
        await admin.from('print_products').update({ shopify_product_handle: handle }).eq('id', row.id)
        results.push({ id: row.id, handle, status: 'updated' })
      } else {
        results.push({ id: row.id, handle: row.shopify_product_handle as string | null, status: handle ? 'unchanged' : 'no_external_handle' })
      }
    } catch (err) {
      results.push({ id: row.id, handle: null, status: `error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  const updated = results.filter(r => r.status === 'updated').length
  return NextResponse.json({ updated, total: results.length, results })
}
