export type WalletType = 'yours' | 'handcash' | 'relayx' | '1sat' | 'metanet' | 'manual'

export interface WalletConnection {
  type: WalletType
  bsvAddress: string
  ordAddress: string
}

interface PersistedSession {
  type: WalletType
  bsvAddress: string
  ordAddress: string
  timestamp: number
}

declare global {
  interface Window {
    yours?: {
      connect(): Promise<{ pubkey?: string; publicKey?: string; address?: string; bsvAddress?: string; identity?: string }>
      getAddresses(): Promise<{ bsvAddress?: string; ordAddress?: string; identityAddress?: string } | string[]>
      signMessage(message: string): Promise<string>
    }
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
      signMessage(message: string): Promise<string>
    }
  }
}

const SESSION_KEY = 'asmr-wallet-session'
const SESSION_TTL = 24 * 60 * 60 * 1000

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
  // 1sat placeholder — always shown so user knows it's coming
  available.push('1sat')

  return available
}

export async function connectWallet(type: WalletType): Promise<WalletConnection> {
  switch (type) {
    case 'yours': {
      const yours = getYours()
      if (!yours) throw new Error('Yours Wallet extension not detected. Install it and refresh.')

      await yours.connect()
      const addrs = await yours.getAddresses()

      let bsvAddress = ''
      let ordAddress = ''
      if (Array.isArray(addrs)) {
        bsvAddress = addrs[0] ?? ''
        ordAddress = addrs[0] ?? ''
      } else {
        bsvAddress = addrs.bsvAddress ?? addrs.identityAddress ?? addrs.ordAddress ?? ''
        ordAddress = addrs.ordAddress ?? bsvAddress
      }

      if (!bsvAddress) throw new Error('Yours Wallet returned no address.')

      const conn: WalletConnection = { type: 'yours', bsvAddress, ordAddress }
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

    case 'relayx': {
      if (!window.relayx) throw new Error('RelayX extension not detected.')
      const result = await window.relayx.connect()
      const conn: WalletConnection = { type: 'relayx', bsvAddress: result.address, ordAddress: result.address }
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
      return yours.signMessage(message)
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
    return { type: data.type, bsvAddress: data.bsvAddress, ordAddress: data.ordAddress }
  } catch {
    return null
  }
}

function _saveSession(conn: WalletConnection): void {
  const data: PersistedSession = {
    type: conn.type,
    bsvAddress: conn.bsvAddress,
    ordAddress: conn.ordAddress,
    timestamp: Date.now(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(data))
}
