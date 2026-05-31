import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

/**
 * Create a Stripe Connect Express account for an artist or curator.
 * Returns the account ID to store against the user's profile.
 */
export async function createConnectedAccount(params: {
  email: string
  country?: string
}): Promise<string> {
  const stripe = getStripe()
  const account = await stripe.accounts.create({
    type: 'express',
    email: params.email,
    country: params.country ?? 'CA',
    capabilities: {
      transfers: { requested: true },
    },
  })
  return account.id
}

/**
 * Generate an onboarding link for a connected account.
 * Redirect the user to this URL to complete their Stripe setup.
 */
export async function createOnboardingLink(params: {
  accountId: string
  returnUrl: string
  refreshUrl: string
}): Promise<string> {
  const stripe = getStripe()
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    return_url: params.returnUrl,
    refresh_url: params.refreshUrl,
    type: 'account_onboarding',
  })
  return link.url
}

/**
 * Transfer funds to a connected account.
 * Used for artist/curator payout after a sale.
 */
export async function transferToArtist(params: {
  amount: number
  currency: string
  destination: string
  description?: string
}): Promise<Stripe.Transfer> {
  const stripe = getStripe()
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency,
    destination: params.destination,
    description: params.description,
  })
}

/**
 * Verify a Stripe webhook signature.
 * Returns the parsed event or throws on invalid signature.
 */
export function constructWebhookEvent(
  rawBody: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required')
  }
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
}
