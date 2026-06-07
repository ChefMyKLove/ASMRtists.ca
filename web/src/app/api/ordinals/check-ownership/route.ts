/**
 * POST /api/ordinals/check-ownership
 *
 * Server-side ordinal ownership check — O(collection size), safe for 14K+ ordinal wallets.
 *
 * For each inscription outpoint this walks the 1sat.app spend chain to find the
 * current UTXO, then resolves the owner by comparing the output locking script
 * against expected P2PKH scripts for the caller's addresses using @bsv/sdk.
 *
 * Two script shapes are handled:
 *   - Plain P2PKH (transferred ordinals): 76a914{20bytes}88ac
 *   - P2PKH + inscription envelope (origin outpoints): 76a914{20bytes}88ac{OP_FALSE OP_IF envelope OP_ENDIF}
 *
 * Body: { outpoints: string[], addresses: string[] }
 *   outpoints — DB format txid_vout (underscore)
 *   addresses — both ordAddress and bsvAddress from the connected wallet
 *
 * Returns: { ownedOutpoints: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { Transaction, P2PKH } from '@bsv/sdk'

export const runtime = 'nodejs'

interface Body {
  outpoints?: string[]
  addresses?: string[]
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json() as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const outpoints = body.outpoints ?? []
  const addresses = (body.addresses ?? []).filter(Boolean)

  if (!outpoints.length || !addresses.length) {
    return NextResponse.json({ ownedOutpoints: [] })
  }

  // Precompute the expected P2PKH locking script hex for each address.
  // Plain P2PKH is always 25 bytes (50 hex chars): 76a914{20bytes}88ac
  // Ordinal origin scripts end with the same 50 chars.
  const addrHexMap = new Map<string, string>()
  for (const addr of addresses) {
    try {
      addrHexMap.set(addr, new P2PKH().lock(addr).toHex())
    } catch {
      // skip malformed addresses
    }
  }

  if (addrHexMap.size === 0) {
    return NextResponse.json({ ownedOutpoints: [] })
  }

  const wocHeaders: Record<string, string> = {}
  if (process.env.WOC_API_KEY) wocHeaders['Authorization'] = process.env.WOC_API_KEY

  const ownedOutpoints: string[] = []

  await Promise.allSettled(
    outpoints.map(async (originOp) => {
      // DB uses txid_vout, 1sat.app uses txid.vout
      const dotOp = originOp.replace(/_(\d+)$/, '.$1')
      try {
        let currentOp = dotOp
        for (let hop = 0; hop < 10; hop++) {
          const txoRes = await fetch(`https://api.1sat.app/1sat/txo/${currentOp}`, {
            next: { revalidate: 0 },
          })
          if (!txoRes.ok) break

          const txo = await txoRes.json() as Record<string, unknown>

          const spend = txo.spend
          if (!spend) {
            // This is the current UTXO for this inscription.
            // Resolve the owner via WhatsonChain raw tx hex + @bsv/sdk.
            const [txid, voutStr] = currentOp.split('.')
            const vout = parseInt(voutStr ?? '0', 10)

            const hexRes = await fetch(
              `https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`,
              { headers: wocHeaders },
            )
            if (!hexRes.ok) {
              console.error('[check-ownership] WoC hex', txid.slice(0, 8), hexRes.status)
              return
            }
            const rawHex = (await hexRes.text()).trim()

            let tx: Transaction
            try {
              tx = Transaction.fromHex(rawHex)
            } catch (e) {
              console.error('[check-ownership] tx parse', txid.slice(0, 8), e)
              return
            }

            const output = tx.outputs[vout]
            if (!output) return

            const lockHex = output.lockingScript.toHex()

            for (const [addr, expectedHex] of addrHexMap) {
              // Plain P2PKH: exact match
              // Origin inscription: P2PKH is prefix, OP_FALSE OP_IF envelope follows
              if (lockHex === expectedHex || lockHex.startsWith(expectedHex)) {
                console.log('[check-ownership] owned', originOp.slice(0, 12), 'addr', addr.slice(0, 10))
                ownedOutpoints.push(originOp)
                return
              }
              void addr // suppress lint
            }
            return
          }

          // Follow the spend chain — ordinals move to vout 0 by 1Sat protocol.
          const spendTxid =
            typeof spend === 'string' ? spend
            : typeof spend === 'object' ? (spend as Record<string, unknown>).txid as string
            : null
          if (!spendTxid) break
          currentOp = `${spendTxid}.0`
        }
      } catch (err) {
        console.error('[check-ownership] error', originOp.slice(0, 12), err)
      }
    }),
  )

  return NextResponse.json({ ownedOutpoints })
}
