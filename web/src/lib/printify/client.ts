/**
 * Printify Admin API client.
 * Requires PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID env vars.
 *
 * Docs: https://developers.printify.com/
 */

const API = 'https://api.printify.com/v1'

function token() {
  const t = process.env.PRINTIFY_API_TOKEN ?? process.env.PRINTIFY_API_KEY
  if (!t) throw new Error('PRINTIFY_API_TOKEN env var is required')
  return t
}

function shopId() {
  const s = process.env.PRINTIFY_SHOP_ID
  if (!s) throw new Error('PRINTIFY_SHOP_ID env var is required')
  return s
}

async function pfy<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token()}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Printify ${init?.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── Image upload ─────────────────────────────────────────────────────────────

/**
 * Upload an image to Printify by URL.
 * Returns the Printify image ID.
 */
export async function uploadImageByUrl(imageUrl: string, filename: string): Promise<string> {
  const data = await pfy<{ id: string }>('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: filename, url: imageUrl }),
  })
  return data.id
}

/**
 * Upload an image to Printify by base64 content.
 * Returns the Printify image ID.
 */
export async function uploadImageByBase64(
  base64: string,
  filename: string,
): Promise<string> {
  const data = await pfy<{ id: string }>('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: filename, contents: base64 }),
  })
  return data.id
}

// ─── Product creation ─────────────────────────────────────────────────────────

export interface PrintifyVariant {
  id: number
  price: number
  is_enabled: boolean
}

export interface CreateProductParams {
  title: string
  description: string
  printifyImageId: string
  blueprintId: number
  printProviderId: number
  variants: PrintifyVariant[]
}

export interface PrintifyProduct {
  id: string
  title: string
  is_locked: boolean
}

export async function createProduct(params: CreateProductParams): Promise<PrintifyProduct> {
  const variantIds = params.variants.map((v) => v.id)

  const body = {
    title: params.title,
    description: params.description,
    blueprint_id: params.blueprintId,
    print_provider_id: params.printProviderId,
    variants: params.variants.map((v) => ({
      id: v.id,
      price: v.price,
      is_enabled: v.is_enabled,
    })),
    print_areas: [
      {
        variant_ids: variantIds,
        placeholders: [
          {
            position: 'front',
            images: [
              {
                id: params.printifyImageId,
                x: 0.5,
                y: 0.5,
                scale: 1,
                angle: 0,
              },
            ],
          },
        ],
      },
    ],
  }

  return pfy<PrintifyProduct>(`/shops/${shopId()}/products.json`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── Publish to Shopify ───────────────────────────────────────────────────────

export interface PublishOptions {
  title: boolean
  description: boolean
  images: boolean
  variants: boolean
  tags: boolean
  keyFeatures: boolean
  shipping_template: boolean
}

export async function publishProduct(
  productId: string,
  options?: Partial<PublishOptions>,
): Promise<void> {
  await pfy(`/shops/${shopId()}/products/${productId}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: options?.title ?? true,
      description: options?.description ?? true,
      images: options?.images ?? true,
      variants: options?.variants ?? true,
      tags: options?.tags ?? true,
      keyFeatures: options?.keyFeatures ?? false,
      shipping_template: options?.shipping_template ?? true,
    }),
  })
}

// ─── Blueprint helpers ────────────────────────────────────────────────────────

export interface PrintifyBlueprintVariant {
  id: number
  title: string
  options: Record<string, string>
  placeholders: { position: string; height: number; width: number }[]
}

/**
 * Fetch variants for a given blueprint + print provider.
 * Useful for seeding PRINTIFY_VARIANT_IDS env var or dynamic selection.
 */
export async function getBlueprintVariants(
  blueprintId: number,
  printProviderId: number,
): Promise<PrintifyBlueprintVariant[]> {
  const data = await pfy<{ variants: PrintifyBlueprintVariant[] }>(
    `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
  )
  return data.variants
}
