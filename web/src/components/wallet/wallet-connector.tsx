'use client'

import { useState, useEffect, useRef } from 'react'
import { useWallet } from '@1sat/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buildConnectionFromWallet,
  connectManual,
  disconnectWallet,
  loadPersistedSession,
  type WalletConnection,
} from '@/lib/wallet/connectors'
import { truncateAddress } from '@/lib/utils'
import { Wallet, X, Loader2 } from 'lucide-react'

interface WalletConnectorProps {
  onConnected?: (conn: WalletConnection) => void
  onDisconnected?: () => void
  /** When true, programmatically opens the connect dialog */
  forceOpen?: boolean
  onForceOpenHandled?: () => void
}

export function WalletConnector({ onConnected, onDisconnected, forceOpen, onForceOpenHandled }: WalletConnectorProps) {
  const { wallet: walletIface, status, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)
  const [conn, setConn] = useState<WalletConnection | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const derivingRef = useRef(false)

  // Load persisted manual-address session on mount (BRC-100 wallets auto-reconnect via WalletProvider)
  useEffect(() => {
    const saved = loadPersistedSession()
    if (saved?.type === 'manual') {
      setConn(saved)
      onConnected?.(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When BRC-100 wallet connects, derive deposit address and build WalletConnection
  useEffect(() => {
    if (!walletIface || derivingRef.current) return
    derivingRef.current = true
    buildConnectionFromWallet(walletIface, 'yours')
      .then((c) => {
        setConn(c)
        onConnected?.(c)
        setOpen(false)
        setConnecting(false)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to derive wallet address')
        setConnecting(false)
      })
      .finally(() => { derivingRef.current = false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletIface])

  // When BRC-100 wallet disconnects, clear non-manual connection
  useEffect(() => {
    if (!walletIface) {
      setConn((prev) => {
        if (prev && prev.type !== 'manual') {
          onDisconnected?.()
          return null
        }
        return prev
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletIface])

  useEffect(() => {
    if (forceOpen) {
      setError(null)
      setOpen(true)
      onForceOpenHandled?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      // No providerType → auto-detects window.CWI (Yours Wallet v5, desktop wallets, etc.)
      await connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    disconnect()
    disconnectWallet()
    setConn(null)
    setError(null)
    onDisconnected?.()
  }

  function handleManual(address: string) {
    try {
      const newConn = connectManual(address)
      setConn(newConn)
      onConnected?.(newConn)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid address')
    }
  }

  const isConnecting = status === 'connecting' || connecting || derivingRef.current

  if (conn) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/5 gap-2"
          onClick={() => { setError(null); setOpen(true) }}
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline font-mono text-xs">
            {truncateAddress(conn.ordAddress, 5)}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/30 hover:text-white/60"
          onClick={handleDisconnect}
          aria-label="Disconnect wallet"
        >
          <X className="h-3.5 w-3.5" />
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-[#0a0a0f]/95 backdrop-blur border-white/10 max-w-sm">
            <DialogHeader>
              <DialogTitle>Switch Wallet</DialogTitle>
            </DialogHeader>
            <ConnectContent
              isConnecting={isConnecting}
              error={error}
              onConnect={handleConnect}
              onManual={handleManual}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-white/20 hover:bg-white/5 gap-2"
        onClick={() => { setError(null); setOpen(true) }}
        disabled={isConnecting}
      >
        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        <span className="hidden sm:inline">{isConnecting ? 'Connecting…' : 'Connect Wallet'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0f]/95 backdrop-blur border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect BSV Wallet</DialogTitle>
          </DialogHeader>
          <ConnectContent
            isConnecting={isConnecting}
            error={error}
            onConnect={handleConnect}
            onManual={handleManual}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function ConnectContent({
  isConnecting,
  error,
  onConnect,
  onManual,
}: {
  isConnecting: boolean
  error: string | null
  onConnect: () => void
  onManual: (address: string) => void
}) {
  const [manualAddr, setManualAddr] = useState('')

  return (
    <div className="space-y-3 pt-1">
      {/* Primary — auto-detect BRC-100 wallet (Yours Wallet v5, window.CWI) */}
      <button
        type="button"
        disabled={isConnecting}
        onClick={onConnect}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
      >
        <span className="text-lg flex-shrink-0">🔵</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">Yours Wallet</p>
          <p className="text-[11px] text-muted-foreground">BRC-100 · auto-detect</p>
        </div>
        {isConnecting && <Loader2 className="h-4 w-4 animate-spin text-white/50 flex-shrink-0" />}
      </button>

      {/* 1sat — coming soon */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-30 cursor-not-allowed">
        <span className="text-lg">🎨</span>
        <span className="text-sm">1Sat Ordinals</span>
        <span className="ml-auto text-[10px] text-white/40">soon</span>
      </div>

      {/* Manual address fallback */}
      <div className="border-t border-white/10 pt-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-white/30 px-1">Or enter address manually</p>
        <div className="flex gap-2">
          <Input
            placeholder="Your BSV / ordinal address"
            value={manualAddr}
            onChange={(e) => setManualAddr(e.target.value)}
            className="h-8 text-xs bg-white/5 border-white/10 font-mono"
            onKeyDown={(e) => e.key === 'Enter' && manualAddr.trim() && onManual(manualAddr)}
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-white/20 hover:bg-white/5"
            disabled={!manualAddr.trim()}
            onClick={() => onManual(manualAddr)}
          >
            Connect
          </Button>
        </div>
        <p className="text-[10px] text-white/30 px-1">Read-only — ownership checking only, no signing</p>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
