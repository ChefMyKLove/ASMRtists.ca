/**
 * MNEE stablecoin treasury helpers
 *
 * Uses @mnee/ts-sdk to distribute MNEE from the platform treasury
 * to artists and curators after print sales.
 *
 * SECURITY: MNEE_TREASURY_WIF must only exist in server-side env vars.
 */

import Mnee from '@mnee/ts-sdk'

function getMnee(): Mnee {
  const apiKey = process.env.MNEE_API_KEY
  if (!apiKey) throw new Error('MNEE_API_KEY environment variable is required')
  return new Mnee({ environment: 'production', apiKey })
}

export interface MneeRecipient {
  /** BSV address */
  address: string
  /** MNEE amount (USD equivalent) */
  amount: number
}

/**
 * Distribute MNEE from the treasury wallet to one or more recipients.
 * Returns the ticketId from the MNEE SDK.
 */
export async function distributeMnee(recipients: MneeRecipient[]): Promise<string> {
  const wif = process.env.MNEE_TREASURY_WIF
  if (!wif) throw new Error('MNEE_TREASURY_WIF environment variable is required')

  const mnee = getMnee()
  const response = await mnee.transfer(
    recipients.map((r) => ({ address: r.address, amount: r.amount })),
    wif
  )
  if (!response.ticketId) {
    throw new Error('MNEE transfer succeeded but no ticketId was returned')
  }
  return response.ticketId
}

/**
 * Get the MNEE balance for a BSV address.
 * Returns the decimal (human-readable) amount.
 */
export async function getMneeBalance(address: string): Promise<number> {
  const mnee = getMnee()
  const balance = await mnee.balance(address)
  return balance.decimalAmount
}

// ── Legacy aliases kept for backwards compat ──────────────────────────────────

export interface TransferParams {
  toAddress: string
  amount: number
  memo?: string
}

export interface TransferResult {
  txid: string
  toAddress: string
  amount: number
}

/**
 * @deprecated Use distributeMnee() instead.
 */
export async function transferFromTreasury(params: TransferParams): Promise<TransferResult> {
  const ticketId = await distributeMnee([{ address: params.toAddress, amount: params.amount }])
  return { txid: ticketId, toAddress: params.toAddress, amount: params.amount }
}

/**
 * @deprecated Use distributeMnee() instead.
 */
export async function distributeBatch(recipients: TransferParams[]): Promise<TransferResult[]> {
  const ticketId = await distributeMnee(
    recipients.map((r) => ({ address: r.toAddress, amount: r.amount }))
  )
  return recipients.map((r) => ({ txid: ticketId, toAddress: r.toAddress, amount: r.amount }))
}
