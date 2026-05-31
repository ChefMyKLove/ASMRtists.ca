import crypto from 'crypto'

/**
 * Printify webhook payload types
 */
export interface PrintifyAddress {
  first_name: string
  last_name: string
  email: string
  phone?: string
  country: string
  region: string
  address1: string
  address2?: string
  city: string
  zip: string
}

export interface PrintifyLineItem {
  product_id: string
  variant_id: number
  quantity: number
  title: string
  sku: string
  cost: number
  shipping_cost: number
}

export interface PrintifyOrder {
  id: string
  external_id: string | null
  status: string
  shipping_method: number
  shipping_info: {
    method: string
    carrier: string
    tracking_number: string | null
    url: string | null
  }
  address_to: PrintifyAddress
  line_items: PrintifyLineItem[]
  metadata: {
    order_type: string
    shop_fulfilled_at?: string
  }
  total_price: number
  total_shipping: number
  total_tax: number
  created_at: string
  updated_at: string
}

export interface PrintifyWebhookPayload {
  type: string
  shop_id: number
  resource: {
    id: string
    type: string
    data: PrintifyOrder
  }
}

/**
 * Verify a Printify webhook HMAC-SHA256 signature.
 *
 * Printify sends the signature in the X-Pfy-Signature header as a hex digest.
 * The secret is PRINTIFY_WEBHOOK_SECRET from environment variables.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET
  if (!secret) {
    console.error('PRINTIFY_WEBHOOK_SECRET is not set')
    return false
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}
