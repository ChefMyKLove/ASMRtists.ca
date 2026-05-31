'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  detectAvailableWallets,
  connectWallet,
  connectManual,
  disconnectWallet,
  loadPersistedSession,
  type WalletType,
  type WalletConnection,
} from '@/lib/wallet/connectors'
import { truncateAddress } from '@/lib/utils'
import { Wallet, X, Loader2 } from 'lucide-react'

const WALLET_LABELS: Record<WalletType, string> = {
  yours: 'Yours Wallet',
  handcash: 'HandCash',
  relayx: 'RelayX',
  metanet: 'Metanet (Babbage)',
  '1sat': '1Sat Ordinals',
  manual: 'Manual address',
}

const WALLET_ICONS: Record<WalletType, string> = {
  yours: '🔵',
  handcash: '✋',
  relayx: '🔄',
  metanet: '🔸',
  '1sat': '🎨',
  manual: '📋',
}

interface WalletConnectorProps {
  onConnected?: (conn: WalletConnection) => void
  onDisconnected?: () => void
}

export function WalletConnector({ onConnected, onDisconnected }: WalletConnectorProps) {
  const [open, setOpen] = useState(false)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [available, setAvailable] = useState<WalletType[]>([])
  const [connecting, setConnecting] = useState<WalletType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = loadPersistedSession()
    if (saved) {
      setConnection(saved)
      onConnected?.(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleOpen() {
    setError(null)
    setOpen(true)
    const wallets = await detectAvailableWallets()
    setAvailable(wallets)
  }

  async function handleConnect(type: WalletType) {
    setConnecting(type)
    setError(null)
    try {
      const conn = await connectWallet(type)
      setConnection(conn)
      onConnected?.(conn)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(null)
    }
  }

  function handleDisconnect() {
    disconnectWallet()
    setConnection(null)
    onDisconnected?.()
  }

  function handleManual(address: string) {
    try {
      const conn = connectManual(address)
      setConnection(conn)
      onConnected?.(conn)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid address')
    }
  }

  if (connection) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/5 gap-2"
          onClick={handleOpen}
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline font-mono text-xs">
            {truncateAddress(connection.bsvAddress, 5)}
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

        {/* Swap wallet dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-[#0a0a0f]/95 backdrop-blur border-white/10 max-w-sm">
            <DialogHeader>
              <DialogTitle>Switch Wallet</DialogTitle>
            </DialogHeader>
            <WalletList
              available={available}
              connecting={connecting}
              error={error}
              onSelect={handleConnect}
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
        onClick={handleOpen}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">Connect Wallet</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0f]/95 backdrop-blur border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect BSV Wallet</DialogTitle>
          </DialogHeader>
          <WalletList
            available={available}
            connecting={connecting}
            error={error}
            onSelect={handleConnect}
            onManual={handleManual}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function WalletList({
  available,
  connecting,
  error,
  onSelect,
  onManual,
}: {
  available: WalletType[]
  connecting: WalletType | null
  error: string | null
  onSelect: (type: WalletType) => void
  onManual: (address: string) => void
}) {
  const [manualAddr, setManualAddr] = useState('')
  const detected = available.filter((w) => w !== '1sat')
  const undetected: WalletType[] = (['yours', 'handcash', 'relayx', 'metanet'] as WalletType[]).filter(
    (w) => !available.includes(w)
  )

  return (
    <div className="space-y-3 pt-1">
      {detected.length > 0 && (
        <div className="space-y-2">
          {detected.map((type) => (
            <WalletButton
              key={type}
              type={type}
              connecting={connecting}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {detected.length === 0 && !connecting && (
        <>
          <p className="text-sm text-muted-foreground text-center py-1">
            No BSV wallet extensions detected.
          </p>
          <a
            href="https://yours.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            <span className="text-lg">🔵</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm">Install Yours Wallet</p>
              <p className="text-[11px] text-muted-foreground">Recommended for BSV ordinals</p>
            </div>
            <span className="text-[10px] text-white/40">↗</span>
          </a>
        </>
      )}

      {undetected.length > 0 && detected.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-white/30 px-1">Not installed</p>
          {undetected.map((type) => (
            <div
              key={type}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed"
            >
              <span className="text-lg">{WALLET_ICONS[type]}</span>
              <span className="text-sm">{WALLET_LABELS[type]}</span>
            </div>
          ))}
        </div>
      )}

      {/* 1sat — always coming soon */}
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-30 cursor-not-allowed">
        <span className="text-lg">{WALLET_ICONS['1sat']}</span>
        <span className="text-sm">{WALLET_LABELS['1sat']}</span>
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

function WalletButton({
  type,
  connecting,
  onSelect,
}: {
  type: WalletType
  connecting: WalletType | null
  onSelect: (type: WalletType) => void
}) {
  const isConnecting = connecting === type
  const isDisabled = connecting !== null

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => onSelect(type)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
    >
      <span className="text-lg flex-shrink-0">{WALLET_ICONS[type]}</span>
      <span className="text-sm flex-1">{WALLET_LABELS[type]}</span>
      {isConnecting && <Loader2 className="h-4 w-4 animate-spin text-white/50 flex-shrink-0" />}
    </button>
  )
}
