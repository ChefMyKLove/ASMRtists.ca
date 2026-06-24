'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WalletConnector } from './wallet-connector'
import { WalletGenerator } from './wallet-generator'
import { saveBsvAddressAction, saveOrdAddressAction } from '@/app/actions/profile'
import type { WalletConnection } from '@/lib/wallet/connectors'
import { Button } from '@/components/ui/button'
import { Copy, Check, Pencil } from 'lucide-react'

interface ProfileWalletSectionProps {
  bsvAddress: string | null
  ordAddress: string | null
}

export function ProfileWalletSection({ bsvAddress, ordAddress }: ProfileWalletSectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function saveAddresses(payAddress: string, ordAddress: string) {
    setSaveError(null)
    const { error: e1 } = await saveBsvAddressAction(payAddress)
    if (e1) { setSaveError(e1); return }
    await saveOrdAddressAction(ordAddress)
    startTransition(() => {
      router.refresh()
      setEditing(false)
    })
  }

  function handleBrowserWalletConnected(conn: WalletConnection) {
    saveAddresses(conn.bsvAddress, conn.ordAddress)
  }

  function handleGeneratorConfirmed(payAddress: string, ordAddress: string) {
    saveAddresses(payAddress, ordAddress)
  }

  function copyAddress() {
    if (!bsvAddress) return
    navigator.clipboard.writeText(bsvAddress).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Address is set and we're not in edit mode ────────────────────────────
  if (bsvAddress && !editing) {
    return (
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">BSV Wallet</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-white/30 hover:text-white/60 transition-colors"
            title="Change wallet"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">BSV Pay Address</p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono break-all text-white/80 flex-1">{bsvAddress}</p>
            <button
              type="button"
              onClick={copyAddress}
              className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {ordAddress && ordAddress !== bsvAddress && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">BSV Ordinals Address</p>
            <p className="text-sm font-mono break-all text-white/80">{ordAddress}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          MNEE payments and ordinals will be sent to these addresses.
        </p>
      </div>
    )
  }

  // ── No address set (or editing) ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {editing ? 'Change BSV Wallet' : 'Connect BSV Wallet'}
        </h2>
        {editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>

      <div className="glass rounded-xl p-6 space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-white/70">Use browser wallet</p>
          <p className="text-xs text-muted-foreground">
            Connect Yours Wallet, HandCash, RelayX, or Metanet if you have an extension installed.
          </p>
          <WalletConnector
            onConnected={handleBrowserWalletConnected}
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0a0a0f] px-3 text-white/30">or</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-white/70">Generate a new wallet</p>
          <p className="text-xs text-muted-foreground">
            Create a fresh BSV wallet. Your seed phrase is shown once — save it somewhere safe.
          </p>
          <WalletGenerator onAddressConfirmed={handleGeneratorConfirmed} />
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{saveError}</p>
      )}

      {isPending && (
        <p className="text-xs text-white/40">Saving…</p>
      )}
    </div>
  )
}
