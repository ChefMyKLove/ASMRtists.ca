/**
 * BSV treasury payout
 *
 * Sends BSV from the platform treasury wallet to a recipient address.
 * Requires env vars:
 *   TREASURY_PAY_WIF    — WIF private key for the treasury BSV address
 *   WOC_API_KEY         — (optional) WhatsOnChain API key
 *   TAAL_API_KEY        — (optional) Taal ARC API key
 *
 * SERVER-SIDE ONLY. Never import this module from client components.
 */

import {
  ARC,
  P2PKH,
  PrivateKey,
  Transaction,
  isBroadcastResponse,
} from '@bsv/sdk'

const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main'

interface WocUtxo {
  tx_hash: string
  tx_pos: number
  value: number
}

/**
 * Send BSV satoshis from the treasury to a single address.
 * Returns the broadcast txid.
 */
export async function sendBsvFromTreasury(toAddress: string, satoshis: number): Promise<string> {
  const wif = process.env.TREASURY_PAY_WIF
  if (!wif) throw new Error('TREASURY_PAY_WIF env var is required')
  if (satoshis <= 0) throw new Error('satoshis must be > 0')

  const privKey = PrivateKey.fromWif(wif)
  const treasuryAddress = privKey.toAddress().toString()

  // Fetch UTXOs
  const utxoResp = await fetch(`${WOC_BASE}/address/${treasuryAddress}/unspent/all`, {
    headers: process.env.WOC_API_KEY ? { Authorization: process.env.WOC_API_KEY } : {},
  })
  if (!utxoResp.ok) throw new Error(`WoC UTXO fetch failed: ${utxoResp.status}`)
  const utxoData = await utxoResp.json()
  const utxos: WocUtxo[] = utxoData.result ?? utxoData ?? []
  if (utxos.length === 0) throw new Error('Treasury wallet has no UTXOs')

  const tx = new Transaction()

  for (const utxo of utxos) {
    const rawResp = await fetch(`${WOC_BASE}/tx/${utxo.tx_hash}/hex`)
    if (!rawResp.ok) throw new Error(`WoC raw-tx fetch failed for ${utxo.tx_hash}: ${rawResp.status}`)
    const rawHex = await rawResp.text()
    const sourceTx = Transaction.fromHex(rawHex)

    tx.addInput({
      sourceTXID: utxo.tx_hash,
      sourceOutputIndex: utxo.tx_pos,
      sourceTransaction: sourceTx,
      unlockingScriptTemplate: new P2PKH().unlock(privKey),
    })
  }

  tx.addOutput({ lockingScript: new P2PKH().lock(toAddress), satoshis })
  tx.addOutput({ lockingScript: new P2PKH().lock(treasuryAddress), change: true })

  await tx.fee()
  await tx.sign()

  const result = await tx.broadcast(
    new ARC('https://arc.taal.com', process.env.TAAL_API_KEY ?? 'mainnet')
  )

  const txid = isBroadcastResponse(result) ? result.txid : (result.txid ?? null)

  if (!txid) throw new Error(`Broadcast returned no valid txid. Raw: ${JSON.stringify(result)}`)
  return txid
}
