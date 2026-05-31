/**
 * POST /api/webhooks/shopify
 *
 * Receives Shopify `orders/paid` webhook events.
 * When a print order is paid on ASMRprints.com, this:
 *   1. Verifies the HMAC signature from Shopify
 *   2. Matches the line item to an artwork via shopify_product_id
 *   3. Calculates revenue split (artist / curator / platform)
 *   4. Creates print_orders row + treasury_ledger entries
 *   5. Queues MNEE distribution to ordinal holders
 *
 * Setup in Shopify: Settings → Notifications → Webhooks
 *   Topic: orders/paid
 *   URL: https://asmrtists.ca/api/webhooks/shopify
 *   Format: JSON
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Shopify webhook payload (partial — only fields we use) ──────────────────

interface ShopifyLineItem {
  id: number
  product_id: number
  variant_id: number
  title: string
  variant_title: string
  quantity: number
  price: string           // string decimal e.g. "45.00"
  vendor: string
  properties: Array<{ name: string; value: string }>
}

interface ShopifyOrderPayload {
  id: number
  order_number: number
  email: string
  total_price: string
  subtotal_price: string
  line_items: ShopifyLineItem[]
  financial_status: string
  created_at: string
}

// ─── HMAC Verification ───────────────────────────────────────────────────────

function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET
  if (!secret) return false
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

// ─── Revenue Split ────────────────────────────────────────────────────────────

interface RevenueSplit {
  grossCents: number
  productionCostCents: number
  platformCents: number
  curatorCents: number
  artistCents: number
}

async function calculateSplit(
  grossCents: number,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<RevenueSplit> {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'revenue_split')
    .single()

  const split = data?.value as { artist_pct: number; holder_pct: number; platform_pct: number }
  const platformPct = (split?.platform_pct ?? 5) / 100
  const holderPct   = (split?.holder_pct ?? 25) / 100

  // Production cost placeholder — ideally fetched from Shopify/Printify
  // For now use 40% of gross as a conservative estimate; refine with real data
  const productionCostCents = Math.round(grossCents * 0.4)
  const net = grossCents - productionCostCents

  const platformCents = Math.round(net * platformPct)
  const curatorCents  = Math.round(net * holderPct)
  const artistCents   = net - platformCents - curatorCents

  return { grossCents, productionCostCents, platformCents, curatorCents, artistCents }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifyShopifyHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const topic = req.headers.get('x-shopify-topic')
  if (topic !== 'orders/paid') {
    // Acknowledge non-orders/paid events so Shopify doesn't retry
    return NextResponse.json({ ok: true, ignored: true })
  }

  let order: ShopifyOrderPayload
  try {
    order = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createClient()

  for (const item of order.line_items) {
    const shopifyProductGid = `gid://shopify/Product/${item.product_id}`

    // Find the matching artwork via print_products
    const { data: product } = await supabase
      .from('print_products')
      .select(`
        id,
        product_type,
        artwork_id,
        artwork:artwork_id (
          id,
          artist_id,
          collections ( curator_id )
        )
      `)
      .eq('shopify_product_id', shopifyProductGid)
      .single()

    if (!product) {
      // Line item doesn't map to a tracked artwork — skip
      console.warn(`[shopify-webhook] No print_product found for Shopify product ${item.product_id}`)
      continue
    }

    const grossCents = Math.round(parseFloat(item.price) * item.quantity * 100)
    const split = await calculateSplit(grossCents, supabase)

    // Insert print_orders row
    const { data: printOrder, error: orderErr } = await supabase
      .from('print_orders')
      .insert({
        artwork_id:           product.artwork_id,
        shopify_order_id:     `gid://shopify/Order/${order.id}`,
        shopify_order_number: String(order.order_number),
        buyer_email:          order.email || null,
        product_type:         product.product_type,
        variant_title:        item.variant_title,
        quantity:             item.quantity,
        unit_price_cents:     Math.round(parseFloat(item.price) * 100),
        production_cost_cents: split.productionCostCents,
        gross_revenue_cents:  split.grossCents,
        platform_fee_cents:   split.platformCents,
        curator_share_cents:  split.curatorCents,
        artist_share_cents:   split.artistCents,
        status:               'pending',
        shopify_order_data:   order,
      })
      .select('id')
      .single()

    if (orderErr || !printOrder) {
      console.error('[shopify-webhook] Failed to insert print_order:', orderErr)
      continue
    }

    const artwork = product.artwork as any
    const curatorId = artwork?.collections?.curator_id ?? null

    // Insert treasury_ledger entries: artist + curator + platform
    type LedgerRow = {
      user_id: string
      order_id: string
      earned_as: 'artist' | 'curator' | 'platform'
      type: 'print_sale' | 'curator_fee' | 'platform_fee'
      amount_usd: number
    }
    const ledgerRows: LedgerRow[] = [
      {
        user_id:    artwork.artist_id,
        order_id:   printOrder.id,
        earned_as:  'artist' as const,
        type:       'print_sale' as const,
        amount_usd: split.artistCents / 100,
      },
      {
        user_id:    process.env.PLATFORM_USER_ID!, // admin user ID seeded at setup
        order_id:   printOrder.id,
        earned_as:  'platform' as const,
        type:       'platform_fee' as const,
        amount_usd: split.platformCents / 100,
      },
    ]

    if (curatorId) {
      ledgerRows.push({
        user_id:    curatorId,
        order_id:   printOrder.id,
        earned_as:  'curator' as const,
        type:       'curator_fee' as const,
        amount_usd: split.curatorCents / 100,
      })
    }

    await supabase.from('treasury_ledger').insert(ledgerRows)

    // TODO: Queue MNEE distribution to ordinal holders (Phase 2 automation)
    // For now: manual trigger from admin dashboard
  }

  return NextResponse.json({ ok: true })
}
