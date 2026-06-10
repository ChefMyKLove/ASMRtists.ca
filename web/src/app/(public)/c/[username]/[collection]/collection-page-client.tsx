'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ShopModal } from '@/components/shopify/shop-modal'
import { CollectionGrid } from '@/components/collection/collection-grid'
import { HolderClaimPanel } from '@/components/collection/holder-claim-panel'
import { WalletConnector } from '@/components/wallet/wallet-connector'
import type { WalletConnection } from '@/lib/wallet/connectors'
import { signMessage } from '@/lib/wallet/connectors'
import type { OwnedOrdinal, BalanceEntry } from '@/lib/bsv/ordinals'
import { Settings, Printer, Copy, Check, CheckCircle2, ExternalLink, Gift, Gem, Wallet, XCircle, Loader2, Coins } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { CollectionData, CollectionArtwork } from '@/components/collection/types'
import type { ShopifyPrice } from '@/lib/shopify'

interface CollectionPageClientProps {
  collection: CollectionData
  isOwningArtist: boolean
  priceMap?: Record<string, ShopifyPrice | null>
}

function fmt(n: number, decimals = 4): string {
  return n === 0 ? '0' : n.toFixed(decimals).replace(/\.?0+$/, '')
}

function truncateOutpoint(outpoint: string, chars = 10): string {
  return outpoint.length > chars * 2
    ? `${outpoint.slice(0, chars)}…${outpoint.slice(-6)}`
    : outpoint
}

function getShopUrl(artwork: CollectionArtwork): string {
  const products = artwork.print_products ?? []
  const preferred = products.find((p) => p.product_type === 'canvas') ?? products[0]
  if (preferred?.shopify_product_handle) {
    return `https://canvas-cosmic-cart.chefmyklove.workers.dev/product/${preferred.shopify_product_handle}?embed=1`
  }
  return `https://canvas-cosmic-cart.chefmyklove.workers.dev/search?q=${encodeURIComponent(artwork.title)}`
}

function getArtworkPrice(
  artwork: CollectionArtwork,
  priceMap: Record<string, { amount: string; currencyCode: string } | null>,
): string | null {
  const products = artwork.print_products ?? []
  for (const p of products) {
    if (p.shopify_product_handle) {
      const price = priceMap[p.shopify_product_handle]
      if (price) {
        return `${price.currencyCode} $${parseFloat(price.amount).toFixed(2)}`
      }
    }
  }
  return null
}

export function CollectionPageClient({
  collection,
  isOwningArtist,
  priceMap = {},
}: CollectionPageClientProps) {
  const { artist, artwork: artworks } = collection

  const [selectedArtwork, setSelectedArtwork] = useState<CollectionArtwork | null>(null)
  const [shopModalOpen, setShopModalOpen] = useState(false)
  const [shopUrl, setShopUrl] = useState('')
  const [shopTitle, setShopTitle] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mintDialogOpen, setMintDialogOpen] = useState(false)
  const [connectedWallet, setConnectedWallet] = useState<WalletConnection | null>(null)
  const [ownedOrdinals, setOwnedOrdinals] = useState<OwnedOrdinal[]>([])
  const [ownedOutpoints, setOwnedOutpoints] = useState<Set<string>>(new Set())
  const [balances, setBalances] = useState<BalanceEntry[]>([])
  const [claimPanelOpen, setClaimPanelOpen] = useState(false)
  const [forceWalletOpen, setForceWalletOpen] = useState(false)
  const [sidebarClaiming, setSidebarClaiming] = useState(false)
  const [sidebarClaimResult, setSidebarClaimResult] = useState<{ ok: boolean; msg: string; txid?: string } | null>(null)

  useEffect(() => {
    setSidebarClaimResult(null)
  }, [selectedArtwork?.id])

  // Derive outpoint from txid when inscription_outpoint wasn't stored at mint time
  function resolveOutpoint(a: CollectionArtwork): string | null {
    return a.inscription_outpoint ?? (a.inscription_txid ? `${a.inscription_txid}_0` : null)
  }

  // Outpoints in this collection that have inscriptions
  const collectionOutpointSet = new Set(
    artworks.map(resolveOutpoint).filter(Boolean) as string[]
  )

  async function handleWalletConnect(conn: WalletConnection) {
    setConnectedWallet(conn)

    // Reverse-lookup: check which collection artworks this wallet currently owns.
    // This is O(artworks) API calls, not O(wallet size) — safe for 14K+ ordinal wallets.
    const outpointsToCheck = [...collectionOutpointSet]
    const addresses = [conn.ordAddress, conn.bsvAddress].filter(Boolean)

    if (outpointsToCheck.length === 0 || addresses.length === 0) return

    let ownedSet = new Set<string>()
    try {
      const res = await fetch('/api/ordinals/check-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outpoints: outpointsToCheck, addresses }),
      })
      if (res.ok) {
        const data = await res.json() as { ownedOutpoints?: string[] }
        ownedSet = new Set(data.ownedOutpoints ?? [])
      }
    } catch {
      // Non-fatal — ownership badges won't show
    }

    // Convert to OwnedOrdinal shape for compatibility with existing state consumers
    const ordinals: OwnedOrdinal[] = [...ownedSet].map((op) => ({
      inscriptionId: op.split('_')[0] ?? op,
      outpoint: op,
      ordAddress: conn.ordAddress,
    }))
    setOwnedOrdinals(ordinals)
    setOwnedOutpoints(ownedSet)

    // Fetch reward balances for owned collection ordinals
    if (ownedSet.size > 0) {
      try {
        const params = new URLSearchParams({ outpoints: [...ownedSet].join(',') })
        const res = await fetch(`/api/claim/balance?${params}`)
        if (res.ok) {
          const json = await res.json()
          setBalances(json.balances ?? [])
        }
      } catch {
        // Non-fatal
      }
    }
  }

  async function handleClaimSingle(outpoint: string) {
    if (!connectedWallet || sidebarClaiming) return
    setSidebarClaiming(true)
    setSidebarClaimResult(null)
    try {
      const chalRes = await fetch('/api/ordinals/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordAddress: connectedWallet.ordAddress }),
      })
      if (!chalRes.ok) {
        const err = await chalRes.json().catch(() => ({}))
        setSidebarClaimResult({ ok: false, msg: (err as { error?: string }).error ?? 'Challenge failed' })
        return
      }
      const { nonce } = await chalRes.json() as { nonce: string }
      const signature = await signMessage(connectedWallet.type, nonce)
      const claimRes = await fetch('/api/ordinals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inscriptionOutpoint: outpoint,
          ordAddress: connectedWallet.ordAddress,
          bsvAddress: connectedWallet.bsvAddress,
          nonce,
          signature,
        }),
      })
      const claimData = await claimRes.json().catch(() => ({})) as { txid?: string; error?: string }
      if (!claimRes.ok) {
        setSidebarClaimResult({ ok: false, msg: claimData.error ?? 'Claim failed' })
      } else if (claimData.txid) {
        setSidebarClaimResult({ ok: true, msg: 'BSV sent!', txid: claimData.txid })
      } else {
        setSidebarClaimResult({ ok: true, msg: 'MNEE queued' })
      }
    } catch (e) {
      setSidebarClaimResult({ ok: false, msg: e instanceof Error ? e.message : 'Unexpected error' })
    } finally {
      setSidebarClaiming(false)
    }
  }

  function handleWalletDisconnect() {
    setConnectedWallet(null)
    setOwnedOrdinals([])
    setOwnedOutpoints(new Set())
    setBalances([])
    setClaimPanelOpen(false)
  }

  // Ordinals from this collection that the connected wallet holds
  const collectionOwnedOrdinals = ownedOrdinals.filter((o) =>
    collectionOutpointSet.has(o.outpoint)
  )

  function openShopModal(artwork: CollectionArtwork) {
    setShopUrl(getShopUrl(artwork))
    setShopTitle(`${artwork.title} — Print`)
    setShopModalOpen(true)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const artworkCount = artworks.length
  const ordinalCount = artworks.filter((a) => !!resolveOutpoint(a)).length
  // Derived outpoint for the currently selected artwork (null when no inscription)
  const selectedOutpoint = selectedArtwork ? resolveOutpoint(selectedArtwork) : null

  return (
    <>
      {/* ── Banner ─────────────────────────────────────────────────── */}
      <div className="relative h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40">
        {collection.cover_image_url && (
          <Image
            src={collection.cover_image_url}
            alt={collection.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#100e09] via-[#100e09]/30 to-transparent" />
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-16">

        {/* ── Collection header ──────────────────────────────────────── */}
        <div className="relative -mt-12 sm:-mt-16 mb-10">

          {/* Wallet + Rewards — top-right */}
          <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
            {connectedWallet && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 hover:bg-white/5 gap-2"
                onClick={() => setClaimPanelOpen(true)}
              >
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">Rewards</span>
                {balances.some((b) => b.mnee_claimable > 0 || b.bsv_claimable > 0) && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Button>
            )}
            <WalletConnector
              onConnected={handleWalletConnect}
              onDisconnected={handleWalletDisconnect}
              forceOpen={forceWalletOpen}
              onForceOpenHandled={() => setForceWalletOpen(false)}
            />
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl leading-tight mb-3 pr-36">
            {collection.title}
          </h1>

          {/* Description */}
          {collection.description && (
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl mb-6">
              {collection.description}
            </p>
          )}

          {/* Artist credit + stats + manage */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/artists/${artist.username}`}
              className="flex items-center gap-2.5 group"
            >
              <Avatar className="h-7 w-7 ring-2 ring-white/10 group-hover:ring-white/30 transition-all">
                <AvatarImage src={artist.avatar_url ?? undefined} alt={artist.display_name} />
                <AvatarFallback className="bg-white/10 text-[10px]">
                  {artist.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground group-hover:text-white transition-colors">
                {artist.display_name}
              </span>
            </Link>

            <Badge variant="secondary" className="text-[11px]">
              {artworkCount} {artworkCount === 1 ? 'piece' : 'pieces'}
            </Badge>

            {ordinalCount > 0 && (
              <Badge className="text-[11px] bg-amber-500/15 text-amber-300 border-amber-500/25">
                {ordinalCount} on-chain
              </Badge>
            )}

            {isOwningArtist && (
              <Link href={`/dashboard/collections/${collection.id}`} className="ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/20 hover:bg-white/5 gap-2"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Manage this collection
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* ── Artwork grid ───────────────────────────────────────────── */}
        <CollectionGrid
          artworks={artworks}
          onSelect={setSelectedArtwork}
          ownedOutpoints={ownedOutpoints}
        />
      </div>

      {/* ── Artwork detail Sheet ──────────────────────────────────────── */}
      <Sheet
        open={!!selectedArtwork}
        onOpenChange={(open) => { if (!open) setSelectedArtwork(null) }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur border-white/10 overflow-y-auto"
        >
          {selectedArtwork && (
            <div className="flex flex-col gap-6 h-full">
              <SheetHeader>
                <SheetTitle className="text-left">{selectedArtwork.title}</SheetTitle>
              </SheetHeader>

              {/* Thumbnail */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                {selectedArtwork.thumbnail_url ? (
                  <Image
                    src={selectedArtwork.thumbnail_url}
                    alt={selectedArtwork.title}
                    fill
                    className="object-cover"
                    sizes="480px"
                  />
                ) : (
                  <div className="aurora-bg absolute inset-0 flex items-center justify-center">
                    <span className="text-white/20 text-3xl font-display">
                      #{String(selectedArtwork.position).padStart(2, '0')}
                    </span>
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-black/60 text-white/60 text-xs font-mono border-0 backdrop-blur-sm">
                  #{String(selectedArtwork.position).padStart(2, '0')}
                </Badge>
                {selectedOutpoint && (
                  <Badge className="absolute top-3 right-3 bg-amber-500/80 text-white text-xs border-0">
                    Ordinal
                  </Badge>
                )}
              </div>

              {/* Description */}
              {selectedArtwork.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedArtwork.description}
                </p>
              )}

              {/* Inscription details */}
              {selectedOutpoint && (
                <div className="glass rounded-xl p-4 space-y-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Inscription
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-white/70 font-mono flex-1 truncate">
                      {truncateOutpoint(selectedOutpoint)}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(selectedOutpoint, `out-${selectedArtwork.id}`)
                      }
                      className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                      aria-label="Copy outpoint"
                    >
                      {copiedId === `out-${selectedArtwork.id}` ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://ordinals.gorillapool.io/content/${selectedOutpoint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                      aria-label="View on GorillaPool"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Ownership + claim section — shown only when minted */}
              {selectedOutpoint && (
                connectedWallet ? (
                  ownedOutpoints.has(selectedOutpoint) ? (
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-emerald-300">You own this ordinal</span>
                      </div>

                      {/* Per-piece reward balance */}
                      {(() => {
                        const b = balances.find((bal) => bal.outpoint === selectedOutpoint)
                        const mnee = b?.mnee_claimable ?? 0
                        const bsv = b?.bsv_claimable ?? 0
                        const hasClaim = mnee > 0 || bsv > 0
                        const isManual = connectedWallet.type === 'manual'
                        return (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="glass rounded-lg p-2.5 text-center">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">MNEE</p>
                                <p className="text-base font-bold rainbow-text">{fmt(mnee, 2)}</p>
                              </div>
                              <div className="glass rounded-lg p-2.5 text-center">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">BSV</p>
                                <p className="text-base font-bold text-amber-300">{fmt(bsv, 6)}</p>
                              </div>
                            </div>

                            {sidebarClaimResult && (
                              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                                sidebarClaimResult.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                              }`}>
                                {sidebarClaimResult.ok
                                  ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                  : <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                                <span>
                                  {sidebarClaimResult.txid
                                    ? `${sidebarClaimResult.msg} · ${sidebarClaimResult.txid.slice(0, 8)}…`
                                    : sidebarClaimResult.msg}
                                </span>
                              </div>
                            )}

                            <Button
                              className="w-full"
                              variant={hasClaim ? 'default' : 'outline'}
                              disabled={!hasClaim || sidebarClaiming || isManual}
                              onClick={() => handleClaimSingle(selectedOutpoint!)}
                            >
                              {sidebarClaiming ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Claiming…
                                </>
                              ) : isManual ? (
                                'Wallet extension required'
                              ) : hasClaim ? (
                                <>
                                  <Coins className="h-4 w-4 mr-2" />
                                  {`Claim — ${fmt(mnee, 2)} MNEE + ${fmt(bsv, 6)} BSV`}
                                </>
                              ) : (
                                'Nothing to claim yet'
                              )}
                            </Button>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="glass rounded-xl p-3 flex items-center gap-2.5">
                      <Gem className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        This ordinal is not in your connected wallet.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="glass rounded-xl p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Own this ordinal? Connect your BSV wallet to verify ownership and claim rewards.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full border-white/20 hover:bg-white/5 gap-2"
                      onClick={() => setForceWalletOpen(true)}
                    >
                      <Wallet className="h-4 w-4" />
                      Connect BSV Wallet
                    </Button>
                  </div>
                )
              )}

              {/* Ordinal section — shown only when NOT yet minted */}
              {!selectedOutpoint && (
                selectedArtwork.jpeg_storage_path ? (
                  <div className="glass rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gem className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">Own the original as an ordinal</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A unique 1-of-1 digital artifact inscribed on the BSV blockchain. Collect it and earn rewards every time a print of this piece sells.
                    </p>
                    <Button
                      onClick={() => setMintDialogOpen(true)}
                      variant="outline"
                      className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                    >
                      <Gem className="h-4 w-4 mr-2" />
                      Mint Ordinal
                    </Button>
                  </div>
                ) : (
                  <div className="glass rounded-xl p-3 flex items-center gap-2.5">
                    <Gem className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      The artist is preparing this piece for on-chain inscription.
                    </p>
                  </div>
                )
              )}

              {/* Print action — always shown */}
              <div className="mt-auto glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-4 w-4 text-sky-400" />
                    <span className="text-sm font-medium">Museum-quality print</span>
                  </div>
                  {(() => {
                    const price = getArtworkPrice(selectedArtwork, priceMap)
                    return price ? (
                      <span className="text-sm font-semibold text-white">
                        from {price}
                      </span>
                    ) : null
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Canvas wraps, art prints, and more. Ships worldwide from ASMRprints.com.
                </p>
                <Button
                  onClick={() => openShopModal(selectedArtwork)}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Buy Print
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Shopify embed modal ──────────────────────────────────────── */}
      <ShopModal
        shopifyUrl={shopUrl}
        title={shopTitle}
        isOpen={shopModalOpen}
        onClose={() => setShopModalOpen(false)}
      />

      {/* ── Mint Ordinal dialog ──────────────────────────────────────── */}
      <Dialog open={mintDialogOpen} onOpenChange={setMintDialogOpen}>
        <DialogContent className="bg-[#0a0a0f]/95 border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="h-4 w-4 text-amber-400" />
              Mint Ordinal
            </DialogTitle>
          </DialogHeader>
          {selectedArtwork && (
            <div className="space-y-4">
              {/* Artwork thumbnail */}
              {selectedArtwork.thumbnail_url && (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5">
                  <Image
                    src={selectedArtwork.thumbnail_url}
                    alt={selectedArtwork.title}
                    fill
                    className="object-cover"
                    sizes="360px"
                  />
                </div>
              )}

              {/* Info */}
              <div className="glass rounded-xl p-4 space-y-1">
                <p className="text-sm font-medium">{selectedArtwork.title}</p>
                <p className="text-xs text-muted-foreground">
                  1-of-1 · BSV blockchain · Proof-of-Patron rewards
                </p>
              </div>

              {/* Wallet state */}
              {!connectedWallet ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Connect your BSV wallet above, then return here to mint this ordinal to your address.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full border-white/20"
                    onClick={() => setMintDialogOpen(false)}
                  >
                    Close &amp; Connect Wallet
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="glass rounded-xl p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      Ordinal destination
                    </p>
                    <code className="text-xs text-white/60 font-mono break-all">
                      {connectedWallet.ordAddress}
                    </code>
                  </div>
                  <Button
                    disabled
                    className="w-full bg-amber-500/20 text-amber-300 border border-amber-500/30 opacity-70 cursor-not-allowed"
                    variant="outline"
                  >
                    <Gem className="h-4 w-4 mr-2" />
                    Minting marketplace coming soon
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Collector minting will be available at launch. Your wallet is ready.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Holder claim panel ───────────────────────────────────────── */}
      {connectedWallet && (
        <HolderClaimPanel
          open={claimPanelOpen}
          onOpenChange={setClaimPanelOpen}
          collectionTitle={collection.title}
          ordAddress={connectedWallet.ordAddress}
          bsvAddress={connectedWallet.bsvAddress}
          walletType={connectedWallet.type}
          ownedOrdinals={collectionOwnedOrdinals}
          balances={balances}
          artworks={artworks}
        />
      )}
    </>
  )
}
