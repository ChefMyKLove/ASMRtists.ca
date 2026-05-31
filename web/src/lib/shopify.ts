/**
 * Shopify Storefront API — server-side utilities for web/
 * Uses NEXT_PUBLIC_* vars (safe — these are read-only Storefront tokens).
 */

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? ''
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? ''
const API_VERSION = '2025-07'

const ENDPOINT = `https://${DOMAIN}/api/${API_VERSION}/graphql.json`

async function storefrontFetch(query: string): Promise<Record<string, unknown>> {
  if (!DOMAIN || !TOKEN) return {}
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query }),
    // Cache for 5 minutes; prices don't change often
    next: { revalidate: 300 },
  })
  if (!res.ok) return {}
  const json = await res.json()
  return (json as { data?: Record<string, unknown> }).data ?? {}
}

export interface ShopifyPrice {
  amount: string
  currencyCode: string
}

/**
 * Fetch the minimum variant price for each product handle in one request.
 * Returns a map of handle → price (null if the product wasn't found).
 */
export async function fetchProductPrices(
  handles: string[],
): Promise<Record<string, ShopifyPrice | null>> {
  const unique = [...new Set(handles.filter(Boolean))]
  if (!unique.length) return {}

  // Build one query with an alias per handle so it's a single HTTP round-trip
  const fields = unique
    .map((h, i) => {
      // Sanitise: strip any quotes to prevent injection
      const safe = h.replace(/['"\\]/g, '')
      return `p${i}: productByHandle(handle: "${safe}") { priceRange { minVariantPrice { amount currencyCode } } }`
    })
    .join('\n')

  const data = await storefrontFetch(`query { ${fields} }`)

  const result: Record<string, ShopifyPrice | null> = {}
  unique.forEach((h, i) => {
    const node = data[`p${i}`] as { priceRange?: { minVariantPrice?: ShopifyPrice } } | null
    result[h] = node?.priceRange?.minVariantPrice ?? null
  })
  return result
}
