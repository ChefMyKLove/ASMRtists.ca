/**
 * In-house 1Sat Ordinals inscription module.
 *
 * Mints a JPEG as a BSV ordinal using the 1Sat Ordinals protocol.
 * The platform funding wallet (WIF in env) pays the fee; the ordinal
 * is delivered to the artist's BSV address.
 *
 * Protocol reference: https://docs.1satordinals.com
 */

import {
  LockingScript,
  OP,
  P2PKH,
  PrivateKey,
  Transaction,
  WhatsOnChainBroadcaster,
} from '@bsv/sdk'

const WOC = 'https://api.whatsonchain.com/v1/bsv/main'
const SAT_PER_BYTE = 0.5 // fee rate (sat/byte) — conservative for fast confirmation

// ─── Types ───────────────────────────────────────────────────────────────────

interface WocUtxo {
  tx_hash: string
  tx_pos: number
  value: number
}

export interface InscribeParams {
  /** JPEG data to inscribe (Buffer or Uint8Array) */
  jpegData: Buffer | Uint8Array
  /** Artist's BSV address — receives the 1-sat ordinal output */
  recipientAddress: string
  /** Optional MAP metadata fields (app, name, type, etc.) */
  metadata?: Record<string, string>
}

export interface InscribeResult {
  txid: string
  /** 1Sat Ordinals outpoint format: txid_0 */
  outpoint: string
  /** Same as outpoint — used as the inscription ID in the DB */
  inscriptionId: string
}

// ─── Script Builder ──────────────────────────────────────────────────────────

/**
 * Build a 1Sat Ordinals inscription locking script.
 *
 * Structure:
 *   OP_FALSE OP_IF
 *     PUSH "ord"          — protocol marker
 *     OP_1                — content-type field
 *     PUSH <contentType>
 *     OP_0                — data field
 *     PUSH <data>
 *   OP_ENDIF
 *   <P2PKH lock for recipientAddress>
 */
function buildInscriptionScript(
  contentType: string,
  data: Buffer | Uint8Array,
  recipientAddress: string
): LockingScript {
  const script = new LockingScript()

  // Inscription envelope
  script.writeOpCode(OP.OP_FALSE)
  script.writeOpCode(OP.OP_IF)
  script.writeBin(Array.from(Buffer.from('ord', 'utf8')))
  script.writeOpCode(OP.OP_1)
  script.writeBin(Array.from(Buffer.from(contentType, 'utf8')))
  script.writeOpCode(OP.OP_0)
  script.writeBin(Array.from(Buffer.from(data)))
  script.writeOpCode(OP.OP_ENDIF)

  // Append P2PKH locking condition so the ordinal is spendable
  const p2pkh = new P2PKH()
  const lock = p2pkh.lock(recipientAddress)
  script.writeScript(lock)

  return script
}

// ─── UTXO Fetching ───────────────────────────────────────────────────────────

async function fetchUtxos(address: string): Promise<WocUtxo[]> {
  const res = await fetch(`${WOC}/address/${address}/unspent`)
  if (!res.ok) throw new Error(`WOC UTXO fetch failed: ${res.status}`)
  const utxos: WocUtxo[] = await res.json()
  return utxos.sort((a, b) => b.value - a.value) // largest first
}

async function fetchRawTx(txid: string): Promise<string> {
  const res = await fetch(`${WOC}/tx/${txid}/hex`)
  if (!res.ok) throw new Error(`WOC raw tx fetch failed for ${txid}: ${res.status}`)
  return res.text()
}

// ─── Main Inscription Function ───────────────────────────────────────────────

/**
 * Inscribe a JPEG as a 1Sat Ordinal on BSV mainnet.
 *
 * Requires PLATFORM_FUNDING_WIF in the server environment.
 * The platform wallet must hold enough BSV to cover fees (~500-2000 sats).
 *
 * This runs server-side only (API route or background job).
 */
export async function inscribeOrdinal(params: InscribeParams): Promise<InscribeResult> {
  const wif = process.env.PLATFORM_FUNDING_WIF
  if (!wif) throw new Error('PLATFORM_FUNDING_WIF env var is required for minting')

  const fundingKey = PrivateKey.fromWif(wif)
  const fundingAddress = fundingKey.toAddress().toString()

  // 1. Fetch UTXOs
  const utxos = await fetchUtxos(fundingAddress)
  if (utxos.length === 0) {
    throw new Error(`Platform funding wallet ${fundingAddress} has no UTXOs. Top it up with BSV.`)
  }

  // 2. Estimate fee & pick covering UTXOs
  const inscriptionSize = params.jpegData.length + 200 // rough overhead
  const estimatedFee = Math.ceil(inscriptionSize * SAT_PER_BYTE) + 500
  const ORDINAL_SAT = 1

  let selected: WocUtxo[] = []
  let totalIn = 0
  for (const utxo of utxos) {
    selected.push(utxo)
    totalIn += utxo.value
    if (totalIn >= ORDINAL_SAT + estimatedFee + 500) break
  }

  if (totalIn < ORDINAL_SAT + estimatedFee) {
    throw new Error(
      `Insufficient BSV in platform wallet. Need ~${ORDINAL_SAT + estimatedFee} sats, have ${totalIn}.`
    )
  }

  // 3. Fetch raw txs for inputs (needed for Transaction signing)
  const sourceTxHexes = await Promise.all(selected.map(u => fetchRawTx(u.tx_hash)))

  // 4. Build transaction
  const tx = new Transaction()

  // Add inputs
  for (let i = 0; i < selected.length; i++) {
    const utxo = selected[i]
    const sourceTx = Transaction.fromHex(sourceTxHexes[i])
    tx.addInput({
      sourceTransaction: sourceTx,
      sourceOutputIndex: utxo.tx_pos,
      unlockingScriptTemplate: new P2PKH().unlock(fundingKey),
    })
  }

  // Output 0: 1-sat ordinal with inscription → artist's address
  const inscriptionScript = buildInscriptionScript(
    'image/jpeg',
    params.jpegData,
    params.recipientAddress
  )
  tx.addOutput({
    lockingScript: inscriptionScript,
    satoshis: ORDINAL_SAT,
  })

  // Output 1: change back to platform wallet
  // We'll compute the actual fee after signing by using a change output placeholder
  const p2pkh = new P2PKH()
  tx.addOutput({
    lockingScript: p2pkh.lock(fundingAddress),
    change: true, // SDK auto-calculates change after fee
  })

  // 5. Compute fee and sign
  await tx.fee()
  await tx.sign()

  // 6. Broadcast
  const broadcaster = new WhatsOnChainBroadcaster('main')
  const result = await tx.broadcast(broadcaster)

  if (!result || typeof result === 'string') {
    throw new Error(`Broadcast failed: ${result}`)
  }

  const txid = tx.id('hex')
  const outpoint = `${txid}_0`

  return {
    txid,
    outpoint,
    inscriptionId: outpoint,
  }
}

// ─── Retry Helper ────────────────────────────────────────────────────────────

/**
 * Attempt inscription with up to `maxRetries` retries on transient failures.
 * Non-retryable errors (bad WIF, insufficient funds) throw immediately.
 */
export async function inscribeWithRetry(
  params: InscribeParams,
  maxRetries = 3
): Promise<InscribeResult> {
  const nonRetryable = ['PLATFORM_FUNDING_WIF', 'Insufficient BSV', 'no UTXOs']

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await inscribeOrdinal(params)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (nonRetryable.some(s => msg.includes(s))) throw err
      if (attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  throw new Error('Inscription failed after all retries')
}
