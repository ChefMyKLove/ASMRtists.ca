/**
 * POST /api/webhooks/shopify
 *
 * Receives Shopify `orders/paid` webhook events.
 * When a print order is paid on ASMRprints.com, this:
 *   1. Verifies the HMAC signature from Shopify
 *   2. Matches the line item to an artwork via shopify_product_id
 *   3. Calculates revenue split (artist / curator / platform)
 *   4. Creates print_orders row + treasury_ledger entries
 *   5. Upserts reward_allocations so ordinal holders can claim MNEE
 *
 * Setup in Shopify: Settings → Notifications → Webhooks
 *   Topic: orders/paid
 *   URL: https://asmrtists.ca/api/webhooks/shopify
 *   Format: JSON
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

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
  holderCents: number    // the pool distributed to inscription holders as MNEE
  artistCents: number
}

async function calculateSplit(
  grossCents: number,
  admin: ReturnType<typeof createAdminClient>,
): Promise<RevenueSplit> {
  const { data } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'revenue_split')
    .single()

  const split = data?.value as { artist_pct: number; holder_pct: number; platform_pct: number } | undefined
  const platformPct = (split?.platform_pct ?? 5) / 100
  const holderPct   = (split?.holder_pct ?? 25) / 100

  // Production cost placeholder — 40% of gross; refine with real Printify cost data
  const productionCostCents = Math.round(grossCents * 0.4)
  const net = grossCents - productionCostCents

  const platformCents = Math.round(net * platformPct)
  const holderCents   = Math.round(net * holderPct)
  const artistCents   = net - platformCents - holderCents

  return { grossCents, productionCostCents, platformCents, holderCents, artistCents }
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
    return NextResponse.json({ ok: true, ignored: true })
  }

  let order: ShopifyOrderPayload
  try {
    order = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  for (const item of order.line_items) {
    const shopifyProductGid = `gid://shopify/Product/${item.product_id}`

    // Find the matching artwork via print_products (admin client bypasses RLS)
    const { data: product } = await admin
      .from('print_products')
      .select(`
        id,
        product_type,
        artwork_id,
        artwork:artwork_id (
          id,
          artist_id,
          inscription_txid,
          inscription_outpoint,
          collections ( curator_id )
        )
      `)
      .eq('shopify_product_id', shopifyProductGid)
      .single()

    if (!product) {
      console.warn(`[shopify-webhook] No print_product for Shopify product ${item.product_id}`)
      continue
    }

    const grossCents = Math.round(parseFloat(item.price) * item.quantity * 100)
    const split = await calculateSplit(grossCents, admin)

    // Insert print_orders row
    const { data: printOrder, error: orderErr } = await admin
      .from('print_orders')
      .insert({
        artwork_id:            product.artwork_id,
        shopify_order_id:      `gid://shopify/Order/${order.id}`,
        shopify_order_number:  String(order.order_number),
        buyer_email:           order.email || null,
        product_type:          product.product_type,
        variant_title:         item.variant_title,
        quantity:              item.quantity,
        unit_price_cents:      Math.round(parseFloat(item.price) * 100),
        production_cost_cents: split.productionCostCents,
        gross_revenue_cents:   split.grossCents,
        platform_fee_cents:    split.platformCents,
        curator_share_cents:   split.holderCents,
        artist_share_cents:    split.artistCents,
        status:                'pending',
        shopify_order_data:    order,
      })
      .select('id')
      .single()

    if (orderErr || !printOrder) {
      console.error('[shopify-webhook] print_order insert failed:', orderErr)
      continue
    }

    const artwork = product.artwork as unknown as {
      id: string
      artist_id: string
      inscription_txid: string | null
      inscription_outpoint: string | null
      collections: Array<{ curator_id: string | null }> | null
    } | null

    const curatorId = artwork?.collections?.[0]?.curator_id ?? null

    // Treasury ledger — artist + platform (+ curator if set)
    type LedgerRow = {
      user_id: string
      order_id: string
      earned_as: 'artist' | 'curator' | 'platform'
      type: 'print_sale' | 'curator_fee' | 'platform_fee'
      amount_usd: number
    }
    const ledgerRows: LedgerRow[] = [
      {
        user_id:    artwork?.artist_id ?? '',
        order_id:   printOrder.id,
        earned_as:  'artist',
        type:       'print_sale',
        amount_usd: split.artistCents / 100,
      },
      {
        user_id:    process.env.PLATFORM_USER_ID ?? '',
        order_id:   printOrder.id,
        earned_as:  'platform',
        type:       'platform_fee',
        amount_usd: split.platformCents / 100,
      },
    ]
    if (curatorId) {
      ledgerRows.push({
        user_id:    curatorId,
        order_id:   printOrder.id,
        earned_as:  'curator',
        type:       'curator_fee',
        amount_usd: split.holderCents / 100,
      })
    }
    await admin.from('treasury_ledger').insert(ledgerRows)

    // Reward allocations — accumulate MNEE for the inscription holder to claim.
    // holderCents is USD cents; 1 MNEE ≈ $0.01 so holderCents MNEE = $holderCents/100 USD.
    // bsv_claimable is left at 0 until BSV/USD price conversion is wired up.
    const insOutpoint =
      artwork?.inscription_outpoint ??
      (artwork?.inscription_txid ? `${artwork.inscription_txid}_0` : null)

    if (insOutpoint && split.holderCents > 0) {
      const { data: existing } = await admin
        .from('reward_allocations')
        .select('id, mnee_claimable, bsv_claimable, bsv21_claimable')
        .eq('inscription_outpoint', insOutpoint)
        .maybeSingle()

      const mneeToAdd = split.holderCents  // 1 unit = $0.01, so cents → MNEE 1:1

      if (existing) {
        await admin
          .from('reward_allocations')
          .update({
            mnee_claimable: Number(existing.mnee_claimable ?? 0) + mneeToAdd,
          })
          .eq('id', existing.id)
      } else {
        await admin.from('reward_allocations').insert({
          inscription_outpoint: insOutpoint,
          artwork_id:           artwork?.id ?? null,
          mnee_claimable:       mneeToAdd,
          bsv_claimable:        0,
          bsv21_claimable:      0,
        })
      }

      console.log(`[shopify-webhook] reward_allocations +${mneeToAdd} MNEE for ${insOutpoint.slice(0, 12)}`)
    }
  }

  return NextResponse.json({ ok: true })
}
