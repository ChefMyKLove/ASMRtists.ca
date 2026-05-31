/**
 * Zoide API inscription helpers (Phase 1)
 *
 * Used to inscribe artwork as BSV Ordinals via the Zoide inscription service.
 */

export interface InscriptionParams {
  /** Artist's BSV address to receive the ordinal */
  receiverAddress: string
  /** Content type, e.g. "image/png" */
  contentType: string
  /** Base64-encoded file content */
  contentBase64: string
  /** Optional metadata to attach to the inscription */
  metadata?: Record<string, string>
}

export interface InscriptionResult {
  inscriptionId: string
  txid: string
  outpoint: string
  status: 'pending' | 'confirmed'
}

/**
 * Submit an inscription request to the Zoide API.
 * Phase 1 implementation — full implementation pending Zoide API docs.
 */
export async function inscribeArtwork(
  params: InscriptionParams
): Promise<InscriptionResult> {
  const apiKey = process.env.ZOIDE_API_KEY
  const apiUrl = process.env.ZOIDE_API_URL

  if (!apiKey) {
    throw new Error('ZOIDE_API_KEY environment variable is required')
  }
  if (!apiUrl) {
    throw new Error('ZOIDE_API_URL environment variable is required')
  }

  const response = await fetch(`${apiUrl}/inscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      receiver: params.receiverAddress,
      content_type: params.contentType,
      content: params.contentBase64,
      metadata: params.metadata ?? {},
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zoide inscription failed: ${error}`)
  }

  return response.json()
}
