export interface BalanceEntry {
  outpoint: string
  mnee_claimable: number
  bsv_claimable: number
  bsv21_claimable: number
}

export interface OwnedOrdinal {
  inscriptionId: string
  outpoint: string
  ordAddress: string
}

interface GorillaPoolTxo {
  txid?: string
  vout?: number
  outpoint?: string
  owner?: string
  origin?: {
    outpoint?: string
    data?: {
      insc?: unknown
      map?: { name?: string }
    }
  }
}

export async function fetchUserOrdinals(ordAddress: string): Promise<OwnedOrdinal[]> {
  if (!ordAddress) return []

  const url = `https://ordinals.gorillapool.io/api/txos/address/${ordAddress}/unspent?bsv20=false&limit=100`

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    // no-store: ownership changes between page loads
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`GorillaPool ${res.status}: ${res.statusText}`)
  }

  const data: GorillaPoolTxo[] = await res.json()

  const seen = new Set<string>()
  const results: OwnedOrdinal[] = []

  for (const item of data) {
    const outpoint = item.origin?.outpoint
    if (!outpoint) continue
    if (seen.has(outpoint)) continue
    seen.add(outpoint)

    // inscriptionId is the txid portion before the underscore
    const inscriptionId = outpoint.split('_')[0] ?? outpoint

    results.push({ inscriptionId, outpoint, ordAddress })
  }

  return results
}
