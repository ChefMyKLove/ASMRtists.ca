/**
 * Platform-escrow ordinal transfer helpers.
 *
 * Flow:
 *   1. Seller lists → client calls window.yours.sendOrdinals() to transfer
 *      ordinal to the platform escrow address.
 *   2. Buyer pays → purchaseListingAction verifies payment, then calls
 *      deliverOrdinalFromEscrow() to send the ordinal to the buyer.
 *
 * The escrow address IS the platform funding wallet address.
 * PLATFORM_FUNDING_WIF signs both the escrow receipt and the delivery tx.
 */

import {
  P2PKH,
  PrivateKey,
  Transaction,
  WhatsOnChainBroadcaster,
} from '@bsv/sdk'

const WOC = 'https://api.whatsonchain.com/v1/bsv/main'

interface WocUtxo {
  tx_hash: string
  tx_pos: number
  value: number
}

function wocHeaders(): Record<string, string> {
  return process.env.WOC_API_KEY ? { Authorization: process.env.WOC_API_KEY } : {}
}

async function fetchRawTx(txid: string): Promise<string> {
  const res = await fetch(`${WOC}/tx/${txid}/hex`, { headers: wocHeaders(), next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`WoC raw-tx fetch failed for ${txid}: ${res.status}`)
  return (await res.text()).trim()
}

async function fetchUtxos(address: string): Promise<WocUtxo[]> {
  const res = await fetch(`${WOC}/address/${address}/unspent`, { headers: wocHeaders(), next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`WoC UTXO fetch failed for ${address}: ${res.status}`)
  const data = await res.json()
  return (Array.isArray(data) ? data : data.result ?? []) as WocUtxo[]
}

/**
 * The platform escrow address — ordinals are sent here when listed.
 * Derived from PLATFORM_FUNDING_WIF, so the same key delivers them to buyers.
 * This is safe to expose publicly (it's just a BSV address).
 */
export function getPlatformEscrowAddress(): string {
  const wif = process.env.PLATFORM_FUNDING_WIF
  if (!wif) throw new Error('PLATFORM_FUNDING_WIF env var is required')
  return PrivateKey.fromWif(wif).toAddress().toString()
}

/**
 * Transfer an ordinal from platform escrow to a buyer's ordinals address.
 *
 * @param escrowTxid  The txid when seller sent ordinal to escrow (ordinal is at vout 0)
 * @param buyerOrdAddress  Buyer's ordinals address (1Sat BIP44 path)
 * @returns  The txid of the delivery transaction
 */
export async function deliverOrdinalFromEscrow(
  escrowTxid: string,
  buyerOrdAddress: string,
  allEscrowTxids: string[] = [],
): Promise<string> {
  const wif = process.env.PLATFORM_FUNDING_WIF
  if (!wif) throw new Error('PLATFORM_FUNDING_WIF env var is required')

  const escrowKey = PrivateKey.fromWif(wif)
  const escrowAddress = escrowKey.toAddress().toString()

  // Ordinal lives at vout 0 of the escrow transaction (1Sat protocol)
  const ordinalVout = 0

  // Fetch the escrow tx (contains the ordinal UTXO)
  const escrowTxHex = await fetchRawTx(escrowTxid)
  const escrowTx = Transaction.fromHex(escrowTxHex)

  // Exclude ALL in-escrow ordinals (vout 0 of any active escrow txid) from fee
  // inputs — not just the one being delivered. Otherwise concurrent listings
  // risk having their ordinals silently spent as fees.
  const protectedSet = new Set([escrowTxid, ...allEscrowTxids])
  const allUtxos = await fetchUtxos(escrowAddress)
  const feeUtxos = allUtxos.filter(
    (u) => !(protectedSet.has(u.tx_hash) && u.tx_pos === ordinalVout),
  )

  const tx = new Transaction()

  // Input 0: ordinal UTXO — MUST be first so 1Sat protocol assigns it to output 0
  tx.addInput({
    sourceTransaction: escrowTx,
    sourceOutputIndex: ordinalVout,
    unlockingScriptTemplate: new P2PKH().unlock(escrowKey),
  })

  // Fee inputs from platform wallet
  for (const utxo of feeUtxos) {
    const rawHex = await fetchRawTx(utxo.tx_hash)
    const sourceTx = Transaction.fromHex(rawHex)
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: utxo.tx_pos,
      unlockingScriptTemplate: new P2PKH().unlock(escrowKey),
    })
    // One fee UTXO is usually enough for a simple transfer
    break
  }

  // Output 0: ordinal to buyer — MUST be first so ordinal lands here
  tx.addOutput({
    lockingScript: new P2PKH().lock(buyerOrdAddress),
    satoshis: 1,
  })

  // Output 1: BSV change back to platform wallet
  tx.addOutput({
    lockingScript: new P2PKH().lock(escrowAddress),
    change: true,
  })

  await tx.fee()
  await tx.sign()

  const broadcaster = new WhatsOnChainBroadcaster('main')
  await tx.broadcast(broadcaster)

  return tx.id('hex')
}

/**
 * Verify that a payment transaction includes ALL required split outputs.
 * Each entry must appear as a P2PKH output with at least `minSats` satoshis.
 * Used to enforce the 75/15/10 revenue split before delivering an ordinal.
 */
export async function verifyPaymentSplit(
  paymentTxid: string,
  required: { address: string; minSats: number }[],
): Promise<boolean> {
  try {
    const rawHex = await fetchRawTx(paymentTxid)
    const tx = Transaction.fromHex(rawHex)
    const lockHexes = tx.outputs.map((o) => ({
      lockHex: o.lockingScript.toHex(),
      satoshis: o.satoshis ?? 0,
    }))
    return required.every(({ address, minSats }) => {
      const expected = new P2PKH().lock(address).toHex()
      return lockHexes.some((o) => o.lockHex === expected && o.satoshis >= minSats)
    })
  } catch {
    return false
  }
}
