import { NextRequest, NextResponse } from 'next/server'
import {
  verifyWebhookSignature,
  type PrintifyWebhookPayload,
} from '@/lib/printify/webhook'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-pfy-signature') ?? ''
  const rawBody = await request.text()

  // Verify HMAC signature — reject unsigned requests immediately
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('Printify webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: PrintifyWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, resource } = payload

  switch (type) {
    case 'order:created':
    case 'order:updated': {
      const order = resource.data
      console.log(`Printify order ${type}: ${order.id} — status: ${order.status}`)

      if (order.status === 'fulfilled') {
        // TODO: Look up the artwork and resolve artist/curator BSV addresses
        // TODO: Calculate revenue split (artist 70%, curator 10%, platform 20%)
        // TODO: Call distributeBatch() from @/lib/mnee/treasury to send MNEE
        // TODO: Mark order as fulfilled in Supabase
        console.log(`Order ${order.id} fulfilled — treasury distribution pending`)
      }
      break
    }

    case 'order:sent_to_production': {
      // TODO: Update order status in Supabase
      console.log(`Order ${resource.data.id} sent to production`)
      break
    }

    default:
      console.log(`Printify webhook: unhandled event type "${type}"`)
  }

  // Always return 200 to acknowledge receipt
  return NextResponse.json({ received: true })
}
