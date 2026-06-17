'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useWallet } from '@1sat/react'
import { truncateAddress } from '@/lib/utils'
import { signMessage, type WalletType } from '@/lib/wallet/connectors'
import type { OwnedOrdinal, BalanceEntry } from '@/lib/bsv/ordinals'
import type { CollectionArtwork } from './types'
import { CheckCircle2, Coins, Gem, Loader2, XCircle } from 'lucide-react'

interface HolderClaimPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionTitle: string
  /** The ordinals address — used for challenge issuance and GorillaPool ownership check */
  ordAddress: string
  /** The BSV address to receive payouts — may differ from ordAddress (e.g. Yours Wallet) */
  bsvAddress: string
  walletType: WalletType
  /** Ordinals the wallet holds that belong to this collection */
  ownedOrdinals: OwnedOrdinal[]
  balances: BalanceEntry[]
  artworks: CollectionArtwork[]
}

interface ClaimResult {
  ok: boolean
  msg: string
  txid?: string
}

function fmt(n: number, decimals = 4): string {
  return n === 0 ? '0' : n.toFixed(decimals).replace(/\.?0+$/, '')
}

export function HolderClaimPanel({
  open,
  onOpenChange,
  collectionTitle,
  ordAddress,
  bsvAddress,
  walletType,
  ownedOrdinals,
  balances,
  artworks,
}: HolderClaimPanelProps) {
  const { wallet: walletIface } = useWallet()
  const [claiming, setClaiming] = useState(false)
  const [claimResults, setClaimResults] = useState<Record<string, ClaimResult>>({})

  const balanceMap = new Map(balances.map((b) => [b.outpoint, b]))
  const artworkMap = new Map(artworks.map((a) => [a.inscription_outpoint, a]))

  const items = ownedOrdinals.map((ord) => ({
    ord,
    artwork: artworkMap.get(ord.outpoint) ?? null,
    balance: balanceMap.get(ord.outpoint) ?? null,
  }))

  const totalMnee = balances.reduce((s, b) => s + b.mnee_claimable, 0)
  const totalBsv = balances.reduce((s, b) => s + b.bsv_claimable, 0)
  const hasBalance = totalMnee > 0 || totalBsv > 0
  const isManual = walletType === 'manual'

  async function handleClaimAll() {
    if (claiming || isManual) return

    const itemsToProcess = items.filter(
      (i) => i.balance && (i.balance.mnee_claimable > 0 || i.balance.bsv_claimable > 0),
    )
    if (itemsToProcess.length === 0) return

    setClaiming(true)

    for (const item of itemsToProcess) {
      const outpoint = item.ord.outpoint
      try {
        // Step 1 — get a one-time challenge nonce from the server
        const chalRes = await fetch('/api/ordinals/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ordAddress }),
        })
        if (!chalRes.ok) {
          const err = await chalRes.json().catch(() => ({}))
          setClaimResults((prev) => ({ ...prev, [outpoint]: { ok: false, msg: (err as { error?: string }).error ?? 'Challenge failed' } }))
          continue
        }
        const { nonce } = await chalRes.json() as { nonce: string }

        // Step 2 — sign the nonce with the connected wallet extension
        if (!walletIface) throw new Error('Wallet not connected — please reconnect your Yours Wallet')
        const signature = await signMessage(walletIface, nonce)

        // Step 3 — submit the claim; server re-verifies ownership + sig
        const claimRes = await fetch('/api/ordinals/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inscriptionOutpoint: outpoint, ordAddress, bsvAddress, nonce, signature }),
        })
        const claimData = await claimRes.json().catch(() => ({})) as { txid?: string; error?: string }

        if (!claimRes.ok) {
          setClaimResults((prev) => ({ ...prev, [outpoint]: { ok: false, msg: claimData.error ?? 'Claim failed' } }))
        } else if (claimData.txid) {
          setClaimResults((prev) => ({ ...prev, [outpoint]: { ok: true, msg: 'BSV sent!', txid: claimData.txid } }))
        } else {
          setClaimResults((prev) => ({ ...prev, [outpoint]: { ok: true, msg: 'MNEE queued' } }))
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unexpected error'
        setClaimResults((prev) => ({ ...prev, [outpoint]: { ok: false, msg } }))
      }
    }

    setClaiming(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur border-white/10 flex flex-col overflow-hidden"
      >
        <SheetHeader className="flex-shrink-0 pb-4 border-b border-white/10">
          <SheetTitle className="text-left text-base">
            Your Rewards
          </SheetTitle>
          <p className="text-xs text-muted-foreground truncate">
            {collectionTitle}
          </p>
          <p className="text-[10px] font-mono text-white/40">
            {truncateAddress(ordAddress, 8)}
          </p>
        </SheetHeader>

        {items.length > 0 && (
          <div className="flex-shrink-0 grid grid-cols-2 gap-3 py-4 border-b border-white/10">
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                MNEE Pending
              </p>
              <p className="text-lg font-bold rainbow-text">
                {fmt(totalMnee, 2)}
              </p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                BSV Pending
              </p>
              <p className="text-lg font-bold text-amber-300">
                {fmt(totalBsv, 6)}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <Gem className="h-10 w-10 text-white/10" />
              <p className="text-sm text-muted-foreground">
                You don&apos;t hold any pieces from this collection.
              </p>
              <p className="text-xs text-white/30">Browse other collections.</p>
            </div>
          ) : (
            items.map(({ ord, artwork, balance }) => {
              const result = claimResults[ord.outpoint]
              return (
                <div
                  key={ord.outpoint}
                  className="flex items-center gap-3 glass rounded-xl p-3"
                >
                  <div className="relative h-12 w-12 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                    {artwork?.thumbnail_url ? (
                      <Image
                        src={artwork.thumbnail_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/20 text-xs font-mono">
                        {artwork ? `#${String(artwork.position).padStart(2, '0')}` : '?'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-medium truncate">
                      {artwork?.title ?? 'Unknown piece'}
                    </p>
                    <p className="text-[10px] font-mono text-white/30 truncate">
                      {ord.outpoint.slice(0, 16)}…
                    </p>
                    {result && (
                      <div className={`flex items-center gap-1 text-[10px] ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.ok
                          ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                          : <XCircle className="h-3 w-3 flex-shrink-0" />}
                        <span className="truncate">
                          {result.txid
                            ? `${result.msg} · ${result.txid.slice(0, 8)}…`
                            : result.msg}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right space-y-0.5">
                    {balance && balance.mnee_claimable > 0 && (
                      <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/20 text-[10px] flex items-center gap-1">
                        <Coins className="h-2.5 w-2.5" />
                        {fmt(balance.mnee_claimable, 2)} MNEE
                      </Badge>
                    )}
                    {balance && balance.bsv_claimable > 0 && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/20 text-[10px] flex items-center gap-1">
                        <Gem className="h-2.5 w-2.5" />
                        {fmt(balance.bsv_claimable, 6)} BSV
                      </Badge>
                    )}
                    {(!balance || (balance.mnee_claimable === 0 && balance.bsv_claimable === 0)) && (
                      <span className="text-[10px] text-white/20">No rewards</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="flex-shrink-0 pt-4 border-t border-white/10 space-y-2">
            {isManual && (
              <p className="text-[11px] text-center text-white/40">
                Connect a wallet extension to sign and claim rewards.
              </p>
            )}
            <Button
              className="w-full"
              disabled={!hasBalance || claiming || isManual}
              onClick={handleClaimAll}
            >
              {claiming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Claiming…
                </>
              ) : isManual ? (
                'Wallet extension required'
              ) : hasBalance ? (
                `Claim All — ${fmt(totalMnee, 2)} MNEE + ${fmt(totalBsv, 6)} BSV`
              ) : (
                'Nothing to claim'
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
