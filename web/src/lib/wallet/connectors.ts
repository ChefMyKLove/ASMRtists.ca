/**
 * BSV Wallet Connectors
 *
 * BSV ordinal wallets carry TWO separate addresses derived from different BIP-44 paths:
 *
 *   ordAddress  (ordinals) — m/44'/236'/1'/0/0  — holds 1Sat ordinals / inscriptions
 *   bsvAddress  (payment)  — m/44'/236'/0'/1/0  — receives BSV, pays fees
 *
 * Yours Wallet getAddresses() field names are CORRECT (not inverted):
 *   getAddresses().ordAddress → the ORDINALS address (m/44'/236'/1'/0/0) e.g. 17ZcP...
 *   getAddresses().bsvAddress → the PAYMENT/change address (m/44'/236'/0'/1/0) e.g. 1LH5U...
 *
 * In array form: [0] = bsvAddress (payment), [1] = ordAddress (ordinals)
 *
 * 1sat.app ownership queries and signMessage() both use the ordinals key.
 * Always pass conn.ordAddress (not conn.bsvAddress) to ownership checks.
 */

export type WalletType = 'yours' | 'handcash' | 'relayx' | '1sat' | 'metanet' | 'manual'

export interface WalletConnection {
  type: WalletType
  /** Ordinals address — m/44'/236'/1'/0/0 for Yours Wallet. Use for ownership queries and signing. */
  ordAddress: string
  /** Payment/change address — m/44'/236'/0'/1/0 for Yours Wallet. Use for BSV payouts. */
  bsvAddress: string
}

interface PersistedSession {
  v?: number  // session schema version — sessions without this are pre-ordinals-fix
  type: WalletType
  bsvAddress: string
  ordAddress: string
  timestamp: number
}

interface YoursOrdinal {
  txid: string
  vout: number
  /** Current UTXO where the ordinal lives: "txid_vout" */
  outpoint: string
  /**
   * Original inscription outpoint — either a bare "txid_vout" string
   * or a GorillaPool-style object { outpoint: "txid_vout" }.
   */
  origin?: { outpoint?: string } | string
}

declare global {
  interface Window {
    yours?: {
      /** v3+: returns a bare string (address/token) or undefined — not an object */
      connect(): Promise<string | undefined>
      /** Returns wallet addresses as an object (v3+ only, no array form) */
      getAddresses(): Promise<{ bsvAddress?: string; ordAddress?: string; identityAddress?: string } | undefined>
      /** v3+: param is an object; return is a SignedMessage object — read .sig for the signature */
      signMessage(params: { message: string; encoding?: 'utf8' | 'hex' | 'base64' }): Promise<{ address: string; pubKey: string; sig: string; message: string } | undefined>
      /**
       * Transfer a single ordinal to a BSV address.
       * origin  = the original inscription outpoint (where it was minted)
       * outpoint = the current UTXO outpoint (where it sits now)
       * Returns the broadcast txid, or undefined on failure.
       */
      transferOrdinal(params: { address: string; origin: string; outpoint: string }): Promise<string | undefined>
      /**
       * Send BSV to one or more recipients.
       * v3+: returns { txid, rawtx } object, not a bare string.
       */
      sendBsv(params: { address: string; satoshis: number }[]): Promise<{ txid: string; rawtx: string } | undefined>
      /**
       * Returns all ordinals held in the wallet with their current UTXO outpoints.
       * Use this to resolve the live outpoint for a given origin before calling transferOrdinal.
       */
      getOrdinals(params?: { limit?: number; offset?: number }): Promise<YoursOrdinal[] | undefined>
    }
    /** Legacy Panda Wallet injection — kept for very old installs, may never resolve */
    YoursWallet?: Window['yours']
    babbage?: {
      getIdentity(): Promise<{ address: string }>
      signMessage(message: string, protocol: string): Promise<string>
    }
    handcash?: {
      connect(): Promise<{ address: string }>
      signMessage(message: string): Promise<string>
    }
    relayx?: {
      connect(): Promise<{ address: string }>
      getAddresses?(): Promise<{ bsvAddress?: string; ordAddress?: string } | string[]>
      signMessage(message: string): Promise<string>
    }
  }
}

const SESSION_KEY = 'asmr-wallet-session'
const SESSION_TTL = 24 * 60 * 60 * 1000
// Bump whenever session schema or address mapping changes — forces a clean reconnect
const SESSION_VERSION = 4

function getYours() {
  return window.yours ?? window.YoursWallet ?? null
}

export async function detectAvailableWallets(): Promise<WalletType[]> {
  const available: WalletType[] = []
  if (typeof window === 'undefined') return available

  if (getYours()) available.push('yours')
  if (window.handcash) available.push('handcash')
  if (window.relayx) available.push('relayx')
  if (window.babbage) available.push('metanet')
  available.push('1sat')

  return available
}

export async function connectWallet(type: WalletType): Promise<WalletConnection> {
  switch (type) {
    case 'yours': {
      const yours = getYours()
      if (!yours) throw new Error('Yours Wallet extension not detected. Install it and refresh.')

      // connect() may hang if the extension's background service worker is busy
      const connectTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Yours Wallet timed out. Try refreshing the page.')), 10_000),
      )
      await Promise.race([yours.connect(), connectTimeout])

      const addrs = await yours.getAddresses()

      // v3+ API: object form only — { bsvAddress, ordAddress, identityAddress }
      let bsvAddress = addrs?.bsvAddress ?? ''
      let ordAddress = addrs?.ordAddress ?? ''

      if (!ordAddress) {
        throw new Error(
          'Yours Wallet did not return an ordinals address. ' +
          'This address is required to detect which ordinals you hold. ' +
          'Try disconnecting and reconnecting, or update the Yours Wallet extension.',
        )
      }
      if (!bsvAddress) bsvAddress = ordAddress

      const conn: WalletConnection = { type: 'yours', bsvAddress, ordAddress }
      _saveSession(conn)
      return conn
    }

    case 'relayx': {
      if (!window.relayx) throw new Error('RelayX extension not detected.')
      await window.relayx.connect()

      let bsvAddress = ''
      let ordAddress = ''

      // RelayX ordinals path: m/44'/236'/0'/2/0 — different from payment
      if (window.relayx.getAddresses) {
        const addrs = await window.relayx.getAddresses()
        if (Array.isArray(addrs)) {
          bsvAddress = (addrs as string[])[0] ?? ''
          ordAddress = (addrs as string[])[1] ?? bsvAddress
        } else {
          bsvAddress = addrs.bsvAddress ?? ''
          ordAddress = addrs.ordAddress ?? bsvAddress
        }
      } else {
        // Older RelayX without getAddresses — connect() result had address
        const result = await window.relayx.connect()
        bsvAddress = (result as { address?: string }).address ?? ''
        ordAddress = bsvAddress
      }

      const conn: WalletConnection = { type: 'relayx', bsvAddress, ordAddress }
      _saveSession(conn)
      return conn
    }

    case 'handcash': {
      if (!window.handcash) throw new Error('HandCash extension not detected.')
      const result = await window.handcash.connect()
      const conn: WalletConnection = { type: 'handcash', bsvAddress: result.address, ordAddress: result.address }
      _saveSession(conn)
      return conn
    }

    case 'metanet': {
      if (!window.babbage) throw new Error('Metanet (Babbage) not detected.')
      const identity = await window.babbage.getIdentity()
      const conn: WalletConnection = { type: 'metanet', bsvAddress: identity.address, ordAddress: identity.address }
      _saveSession(conn)
      return conn
    }

    case '1sat':
      throw new Error('1Sat Ordinals wallet integration coming soon.')

    case 'manual':
      throw new Error('Use connectManual() for manual address entry.')

    default:
      throw new Error(`Unknown wallet type: ${type}`)
  }
}

export function connectManual(ordAddress: string): WalletConnection {
  const trimmed = ordAddress.trim()
  if (!trimmed) throw new Error('Address cannot be empty.')
  const conn: WalletConnection = { type: 'manual', bsvAddress: trimmed, ordAddress: trimmed }
  _saveSession(conn)
  return conn
}

export async function signMessage(type: WalletType, message: string): Promise<string> {
  switch (type) {
    case 'yours': {
      const yours = getYours()
      if (!yours) throw new Error('Yours Wallet not connected.')
      // v3+ API: param is an object; result is a SignedMessage object — extract .sig
      const result = await yours.signMessage({ message })
      if (!result?.sig) throw new Error('Yours Wallet did not return a signature.')
      return result.sig
    }
    case 'handcash': {
      if (!window.handcash) throw new Error('HandCash not connected.')
      return window.handcash.signMessage(message)
    }
    case 'relayx': {
      if (!window.relayx) throw new Error('RelayX not connected.')
      return window.relayx.signMessage(message)
    }
    case 'metanet': {
      if (!window.babbage) throw new Error('Metanet not connected.')
      return window.babbage.signMessage(message, 'identity')
    }
    case '1sat':
      throw new Error('1Sat signing not yet implemented.')
    case 'manual':
      throw new Error('Manual address sessions cannot sign messages. Install a BSV wallet extension.')
    default:
      throw new Error(`Unknown wallet type: ${type}`)
  }
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

    // Discard any session saved before the ordinals-address fix was deployed.
    // Version 2 is the first version that stores the correct separate ordAddress.
    if (!data.v || data.v < SESSION_VERSION) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }

    return { type: data.type, bsvAddress: data.bsvAddress, ordAddress: data.ordAddress }
  } catch {
    return null
  }
}

/**
 * Resolves the current UTXO outpoint for a given ordinal origin.
 *
 * An ordinal's origin (inscription outpoint) never changes, but the UTXO it
 * lives in does every time it's transferred. YoursWallet's transferOrdinal()
 * requires BOTH the origin and the live outpoint — call this before listing.
 *
 * Falls back to returning `origin` unchanged if the wallet doesn't support
 * getOrdinals() or the ordinal isn't found (covers unmoved ordinals where
 * origin === outpoint).
 */
export async function resolveCurrentOutpoint(origin: string): Promise<string> {
  const yours = typeof window !== 'undefined' ? getYours() : null
  if (!yours?.getOrdinals) return origin
  try {
    const ordinals = await yours.getOrdinals()
    if (!ordinals?.length) return origin
    const match = ordinals.find((o) => {
      // GorillaPool-style: origin is { outpoint: "txid_vout" }
      // Flat style:        origin is "txid_vout"
      const oOrigin =
        typeof o.origin === 'string'
          ? o.origin
          : (o.origin?.outpoint ?? o.outpoint)
      return oOrigin === origin || o.outpoint === origin
    })
    return match?.outpoint ?? origin
  } catch {
    return origin
  }
}

function _saveSession(conn: WalletConnection): void {
  const data: PersistedSession = {
    v: SESSION_VERSION,
    type: conn.type,
    bsvAddress: conn.bsvAddress,
    ordAddress: conn.ordAddress,
    timestamp: Date.now(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
