/**
 * BSV Wallet Connectors — BRC-100 Edition
 *
 * Yours Wallet v5 removed window.yours entirely. Connection now goes through
 * the @1sat/react WalletProvider + useWallet() hook, which provides a BRC-100
 * WalletInterface. This module bridges that interface with our app-level
 * WalletConnection type (which holds the derived addresses).
 *
 * ordAddress  — deposit address derived under P1SAT protocol
 * bsvAddress  — same address (BRC-100 unifies the two paths)
 *
 * For ownership queries and signing, use ordAddress.
 */

import { createContext, deriveDepositAddresses, signBsm } from '@1sat/actions'
import type { WalletInterface, WalletOutput } from '@bsv/sdk'

export type WalletType = 'yours' | 'handcash' | 'relayx' | '1sat' | 'metanet' | 'manual'

export interface WalletConnection {
  type: WalletType
  /** Derived deposit address — use for ownership queries and signing. */
  ordAddress: string
  /** Same as ordAddress in BRC-100 (unified address). Use for BSV payouts. */
  bsvAddress: string
}

interface PersistedSession {
  v?: number
  type: WalletType
  bsvAddress: string
  ordAddress: string
  timestamp: number
}

const SESSION_KEY = 'asmr-wallet-session'
const SESSION_TTL = 24 * 60 * 60 * 1000
// Bump to 5 for BRC-100 migration — forces a clean reconnect
const SESSION_VERSION = 5

/** Build a BRC-100 action context from a live WalletInterface. */
export function buildActionContext(wallet: WalletInterface) {
  return createContext(wallet, { chain: 'main' })
}

/** Derive deposit addresses from the BRC-100 wallet. */
export async function resolveAddresses(wallet: WalletInterface): Promise<{ ordAddress: string; bsvAddress: string }> {
  const ctx = buildActionContext(wallet)
  const result = await deriveDepositAddresses.execute(ctx, { startIndex: 0, count: 1 })
  const address = result.derivations?.[0]?.address ?? ''
  if (!address) throw new Error('BRC-100 wallet did not return a deposit address.')
  return { ordAddress: address, bsvAddress: address }
}

/** Build a WalletConnection from a BRC-100 WalletInterface and persist the session. */
export async function buildConnectionFromWallet(
  wallet: WalletInterface,
  type: WalletType = 'yours',
): Promise<WalletConnection> {
  const { ordAddress, bsvAddress } = await resolveAddresses(wallet)
  const conn: WalletConnection = { type, bsvAddress, ordAddress }
  _saveSession(conn)
  return conn
}

/** Sign a message using the BRC-100 wallet (BSM format). */
export async function signMessage(wallet: WalletInterface, message: string): Promise<string> {
  const ctx = buildActionContext(wallet)
  const result = await signBsm.execute(ctx, { message })
  if (result.error) throw new Error(`signBsm failed: ${result.error}`)
  if (!result.sig) throw new Error('Wallet did not return a signature.')
  return result.sig
}

/**
 * Find the wallet's live WalletOutput for a given origin outpoint.
 * The origin never changes but the UTXO might — this locates the current output.
 * Used before calling transferOrdinals.execute().
 */
export function findOrdinalOutput(outputs: WalletOutput[], originOutpoint: string): WalletOutput | undefined {
  // Normalize txid.vout → txid_vout so BSV SDK and 1sat formats both match
  const toUnderscore = (op: string) => op.replace(/\.(\d+)$/, '_$1')
  const normalOrigin = toUnderscore(originOutpoint)

  return outputs.find((o) => {
    if (toUnderscore(o.outpoint) === normalOrigin) return true
    return o.tags?.some((t) => {
      const normalTag = toUnderscore(t)
      return normalTag === `origin:${normalOrigin}` || normalTag.endsWith(normalOrigin)
    })
  })
}

/** Manual address entry — read-only, no signing. */
export function connectManual(ordAddress: string): WalletConnection {
  const trimmed = ordAddress.trim()
  if (!trimmed) throw new Error('Address cannot be empty.')
  const conn: WalletConnection = { type: 'manual', bsvAddress: trimmed, ordAddress: trimmed }
  _saveSession(conn)
  return conn
}

export function disconnectWallet(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
  }
}

export function loadPersistedSession(): WalletConnection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data: PersistedSession = JSON.parse(raw)

    if (Date.now() - data.timestamp > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    // Discard sessions from before BRC-100 migration
    if (!data.v || data.v < SESSION_VERSION) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    return { type: data.type, bsvAddress: data.bsvAddress, ordAddress: data.ordAddress }
  } catch {
    return null
  }
}

function _saveSession(conn: WalletConnection): void {
  if (typeof window === 'undefined') return
  const data: PersistedSession = {
    v: SESSION_VERSION,
    type: conn.type,
    bsvAddress: conn.bsvAddress,
    ordAddress: conn.ordAddress,
    timestamp: Date.now(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
