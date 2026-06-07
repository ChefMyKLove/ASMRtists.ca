/**
 * 1Sat Ordinals ownership queries
 *
 * Uses api.1sat.app as the authoritative source for ordinals on BSV.
 * Ownership is determined by the ORDINALS address (m/44'/236'/1'/0/0),
 * NOT the payment address. Always pass conn.ordAddress, not conn.bsvAddress.
 *
 * Comparison key: origin outpoint (txid_vout) — this is what the database stores
 * as inscription_outpoint and what never changes regardless of ordinal transfers.
 */

export interface BalanceEntry {
  outpoint: string
  mnee_claimable: number
  bsv_claimable: number
  bsv21_claimable: number
}

export interface OwnedOrdinal {
  inscriptionId: string
  /** Origin outpoint — format: txid_vout (underscore separator) */
  outpoint: string
  ordAddress: string
}

// ─── 1sat.app SSE response shape ─────────────────────────────────────────────

interface OneSatTxo {
  outpoint?: string
  satoshis?: number
  data?: {
    origin?: {
      outpoint?: string
    }
    insc?: unknown
  }
}

/**
 * Fetch all ordinals currently held at an ordinals address.
 *
 * Uses the 1sat.app /owner/{address}/txos SSE stream.
 * Returns the ORIGIN outpoint for each ordinal — this matches
 * inscription_outpoint in the database and never changes after minting.
 *
 * NOTE: For large wallets (10K+ ordinals), prefer fetchCollectionOwnership
 * which reverse-looks up specific inscriptions rather than enumerating all.
 */
export async function fetchUserOrdinals(ordAddress: string): Promise<OwnedOrdinal[]> {
  if (!ordAddress) return []

  return new Promise<OwnedOrdinal[]>((resolve, reject) => {
    const url = `https://api.1sat.app/1sat/owner/${encodeURIComponent(ordAddress)}/txos?tags=*`

    if (typeof EventSource === 'undefined') {
      resolve([])
      return
    }

    const es = new EventSource(url)
    const results: OwnedOrdinal[] = []
    const seen = new Set<string>()

    const timer = setTimeout(() => {
      es.close()
      resolve(results)
    }, 20_000)

    es.addEventListener('txo', (e: MessageEvent) => {
      try {
        const txo: OneSatTxo = JSON.parse(e.data as string)
        let outpoint: string = txo?.data?.origin?.outpoint ?? txo?.outpoint ?? ''
        if (!outpoint || seen.has(outpoint)) return
        // Normalize: 1sat.app returns txid.vout (dot), DB stores txid_vout (underscore)
        outpoint = outpoint.replace(/^([0-9a-f]{64})\.(\d+)$/i, '$1_$2')
        seen.add(outpoint)
        const inscriptionId = outpoint.split('_')[0] ?? outpoint
        results.push({ inscriptionId, outpoint, ordAddress })
      } catch {
        // ignore malformed events
      }
    })

    es.addEventListener('done', () => {
      clearTimeout(timer)
      es.close()
      resolve(results)
    })

    es.onerror = () => {
      clearTimeout(timer)
      es.close()
      reject(new Error(`Failed to load ordinals for ${ordAddress.slice(0, 12)}… from 1sat.app`))
    }
  })
}

/**
 * Check ownership for a specific set of inscription outpoints.
 *
 * Reverse-lookup: follows each inscription's spend chain on 1sat.app to find
 * the current UTXO, then resolves the owner address via WhatsonChain.
 * O(collection size), not O(wallet size) — safe for 14K+ ordinal wallets.
 */
export async function fetchCollectionOwnership(
  originOutpoints: string[],   // txid_vout format (underscore) — from DB
  userAddresses: string[],     // wallet addresses to match against
): Promise<Set<string>> {
  const owned = new Set<string>()
  if (!originOutpoints.length || !userAddresses.length) return owned
  const addrSet = new Set(userAddresses.filter(Boolean))

  await Promise.allSettled(
    originOutpoints.map(async (originOp) => {
      const dotOp = originOp.replace(/_(\d+)$/, '.$1')
      try {
        // Walk the spend chain to find the current unspent UTXO for this inscription.
        // By 1Sat protocol, ordinals transfer to vout 0 of each spending tx.
        let currentOp = dotOp
        for (let hop = 0; hop < 10; hop++) {
          const txoRes = await fetch(`https://api.1sat.app/1sat/txo/${currentOp}`)
          if (!txoRes.ok) break
          const txo = await txoRes.json() as Record<string, unknown>

          const spend = txo.spend
          if (!spend) {
            // This is the current UTXO — resolve the owner via WhatsonChain.
            // The 1sat.app TXO endpoint does not expose owner addresses directly;
            // WhatsonChain decodes scriptPubKey.addresses from the raw tx.
            const [txid, voutStr] = currentOp.split('.')
            const vout = parseInt(voutStr ?? '0', 10)
            const wocRes = await fetch(
              `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}`
            )
            if (!wocRes.ok) break
            const wocTx = await wocRes.json() as Record<string, unknown>
            const vouts = wocTx.vout as Array<Record<string, unknown>> | undefined
            const addrs = (vouts?.[vout]?.scriptPubKey as Record<string, unknown> | undefined)
              ?.addresses as string[] | undefined
            if (addrs?.some(a => addrSet.has(a))) owned.add(originOp)
            return
          }

          const spendTxid = typeof spend === 'string' ? spend
            : typeof spend === 'object' ? (spend as Record<string, unknown>).txid as string
            : null
          if (!spendTxid) break
          currentOp = `${spendTxid}.0`
        }
      } catch {
        // non-fatal
      }
    })
  )
  return owned
}
