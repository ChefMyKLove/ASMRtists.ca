'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ShopModal } from '@/components/shopify/shop-modal'
import { Card, CardContent } from '@/components/ui/card'
import { WalletConnector } from '@/components/wallet/wallet-connector'
import { HolderClaimPanel } from '@/components/collection/holder-claim-panel'
import type { OwnedOrdinal, BalanceEntry } from '@/lib/bsv/ordinals'
import type { WalletConnection } from '@/lib/wallet/connectors'
import { cn } from '@/lib/utils'
import { Printer, Gem, CheckCircle2, Gift, ExternalLink, Copy, Check } from 'lucide-react'

interface Artwork {
  id: string
  collectionSlug: string
  title: string
  description: string
  thumbnailUrl: string
  pricePrintCad: number
  priceOrdinalMnee: number
  printProducts: { handle: string; productType: string }[]
  inscriptionId?: string
  inscriptionOutpoint?: string
  isOrdinal: boolean
}

interface Ordinal {
  id: string
  title: string
  thumbnailUrl: string
  inscriptionId: string
  outpoint: string
  collectionUrl: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  holderCount: number
}

interface Collection {
  id: string
  title: string
  slug: string
  coverImageUrl: string | null
  pieceCount: number
}

interface ArtistPageClientProps {
  artworks: Artwork[]
  ordinals: Ordinal[]
  artistSlug: string
  collections: Collection[]
}

const rarityColors: Record<Ordinal['rarity'], string> = {
  common: 'bg-white/20 text-white',
  uncommon: 'bg-sky-500/80 text-white',
  rare: 'bg-purple-500/80 text-white',
  legendary: 'bg-amber-500/80 text-white',
}

function truncateId(id: string, chars = 8) {
  return id.length > chars * 2 ? `${id.slice(0, chars)}…${id.slice(-4)}` : id
}

export function ArtistPageClient({ artworks, ordinals, artistSlug, collections }: ArtistPageClientProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)
  const [shopModalOpen, setShopModalOpen] = useState(false)
  const [shopUrl, setShopUrl] = useState('')
  const [shopTitle, setShopTitle] = useState('')
  const [shopPrintProducts, setShopPrintProducts] = useState<{ handle: string; productType: string }[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [connectedWallet, setConnectedWallet] = useState<WalletConnection | null>(null)
  const [ownedOutpoints, setOwnedOutpoints] = useState<Set<string>>(new Set())
  const [balances, setBalances] = useState<BalanceEntry[]>([])
  const [ownedOrdinals, setOwnedOrdinals] = useState<OwnedOrdinal[]>([])
  const [claimPanelOpen, setClaimPanelOpen] = useState(false)
  const [forceWalletOpen, setForceWalletOpen] = useState(false)

  // Derive outpoint from txid when inscription_outpoint wasn't stored at mint time
  function resolveArtworkOutpoint(a: Artwork): string | null {
    return a.inscriptionOutpoint ?? (a.inscriptionId ? `${a.inscriptionId}_0` : null)
  }

  // All inscription outpoints across this artist's collections
  const allOutpointSet = new Set(ordinals.map((o) => o.outpoint).filter(Boolean))

  async function handleWalletConnect(conn: WalletConnection) {
    setConnectedWallet(conn)

    const outpointsToCheck = [...allOutpointSet]
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
      // non-fatal
    }

    const fetched: OwnedOrdinal[] = [...ownedSet].map((op) => ({
      inscriptionId: op.split('_')[0] ?? op,
      outpoint: op,
      ordAddress: conn.ordAddress,
    }))
    setOwnedOrdinals(fetched)
    setOwnedOutpoints(ownedSet)

    if (ownedSet.size > 0) {
      try {
        const params = new URLSearchParams({ outpoints: [...ownedSet].join(',') })
        const res = await fetch(`/api/claim/balance?${params}`)
        if (res.ok) {
          const json = await res.json()
          setBalances(json.balances ?? [])
        }
      } catch {
        // non-fatal
      }
    }
  }

  function handleWalletDisconnect() {
    setConnectedWallet(null)
    setOwnedOrdinals([])
    setOwnedOutpoints(new Set())
    setBalances([])
    setClaimPanelOpen(false)
  }

  // Ordinals this wallet holds from this artist
  const collectionOwnedOrdinals = ownedOrdinals.filter((o) => allOutpointSet.has(o.outpoint))

  // Build artworks list for HolderClaimPanel (needs CollectionArtwork shape)
  const claimArtworks = ordinals.map((o) => ({
    id: o.id,
    position: 0,
    title: o.title,
    description: null,
    thumbnail_url: o.thumbnailUrl,
    jpeg_storage_path: null,
    inscription_txid: o.inscriptionId,
    inscription_outpoint: o.outpoint,
    ordinal_metadata: null,
    print_products: [],
  }))

  function openPrintModal(artwork: Artwork) {
    if (!artwork.printProducts.length) return
    const preferred =
      artwork.printProducts.find((p) => p.productType === 'canvas') ?? artwork.printProducts[0]
    setShopUrl(`https://canvas-cosmic-cart.chefmyklove.workers.dev/product/${preferred.handle}?embed=1`)
    setShopTitle(`${artwork.title} — Print`)
    setShopPrintProducts(artwork.printProducts)
    setShopModalOpen(true)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <>
      {/* ── Wallet bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 mb-6">
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

      <Tabs defaultValue="collections" className="pb-16">
        <TabsList className="mb-6 bg-white/5">
          <TabsTrigger value="collections">
            Collections
            {collections.length > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {collections.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="gallery">
            Gallery
            {artworks.length > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {artworks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="ordinals">
            Ordinals
            {ordinals.length > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {ordinals.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Collections tab ──────────────────────────────────── */}
        <TabsContent value="collections">
          {collections.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No collections yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {collections.map((col) => (
                <Link
                  key={col.id}
                  href={`/c/${artistSlug}/${col.slug}`}
                  className="group block"
                >
                  <Card className="glass overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
                    <div className="relative aspect-square bg-white/5">
                      {col.coverImageUrl ? (
                        <Image
                          src={col.coverImageUrl}
                          alt={col.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 to-pink-900/30" />
                      )}
                    </div>
                    <CardContent className="p-3 space-y-0.5">
                      <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
                        {col.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {col.pieceCount} {col.pieceCount === 1 ? 'piece' : 'pieces'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Gallery tab ─────────────────────────────────────── */}
        <TabsContent value="gallery">
          {artworks.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No artworks yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {artworks.map((artwork) => (
                <button
                  key={artwork.id}
                  onClick={() => setSelectedArtwork(artwork)}
                  className="group text-left block"
                  type="button"
                >
                  <Card className="glass overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
                    <div className="relative aspect-square bg-white/5">
                      <Image
                        src={artwork.thumbnailUrl}
                        alt={artwork.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                      {artwork.isOrdinal && (
                        <Badge className="absolute top-2 left-2 bg-amber-500/80 text-white text-[10px]">
                          Ordinal
                        </Badge>
                      )}
                      {resolveArtworkOutpoint(artwork) && connectedWallet && ownedOutpoints.has(resolveArtworkOutpoint(artwork)!) && (
                        <Badge className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Owned
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
                        {artwork.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Print: CA${artwork.pricePrintCad}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          Ordinal: {artwork.priceOrdinalMnee} MNEE
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Ordinals tab ─────────────────────────────────────── */}
        <TabsContent value="ordinals">
          {ordinals.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No ordinals minted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ordinals.map((ordinal) => {
                const owned = connectedWallet && ownedOutpoints.has(ordinal.outpoint)
                return (
                  <Card key={ordinal.id} className={cn('glass overflow-hidden', owned && 'ring-1 ring-emerald-500/40')}>
                    <div className="relative aspect-square bg-white/5">
                      <Image
                        src={ordinal.thumbnailUrl}
                        alt={ordinal.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                      <Badge
                        className={cn(
                          'absolute top-2 left-2 text-[10px] capitalize',
                          rarityColors[ordinal.rarity]
                        )}
                      >
                        {ordinal.rarity}
                      </Badge>
                      {owned && (
                        <Badge className="absolute top-2 right-2 bg-emerald-500/80 text-white text-[10px] gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          You own this
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium">{ordinal.title}</p>

                      {/* Inscription ID */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          Inscription ID
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-white/70 font-mono">
                            {truncateId(ordinal.inscriptionId)}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(ordinal.inscriptionId, `ins-${ordinal.id}`)}
                            className="text-muted-foreground hover:text-white transition-colors"
                            aria-label="Copy inscription ID"
                          >
                            {copiedId === `ins-${ordinal.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <a
                            href={`https://ordinals.gorillapool.io/content/${ordinal.inscriptionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-white transition-colors"
                            aria-label="View on GorillaPool"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      {/* Outpoint */}
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                          Outpoint
                        </p>
                        <code className="text-xs text-white/50 font-mono">
                          {truncateId(ordinal.outpoint, 10)}
                        </code>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>{ordinal.holderCount} {ordinal.holderCount === 1 ? 'holder' : 'holders'}</span>
                      </div>

                      {/* Ownership claim CTA */}
                      {owned ? (
                        <Button
                          variant="outline"
                          className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 gap-2"
                          onClick={() => setClaimPanelOpen(true)}
                        >
                          <Gift className="h-4 w-4" />
                          View Your Rewards
                        </Button>
                      ) : connectedWallet ? (
                        <Link
                          href={ordinal.collectionUrl}
                          className="block w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors py-1"
                        >
                          View collection →
                        </Link>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full border-white/20 hover:bg-white/5 gap-2 text-sm"
                          onClick={() => setForceWalletOpen(true)}
                        >
                          Connect Wallet to Claim
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Artwork detail Sheet ─────────────────────────────── */}
      <Sheet open={!!selectedArtwork} onOpenChange={(open) => { if (!open) setSelectedArtwork(null) }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur border-white/10 overflow-y-auto"
        >
          {selectedArtwork && (
            <div className="flex flex-col gap-6 h-full">
              <SheetHeader>
                <SheetTitle className="text-left">{selectedArtwork.title}</SheetTitle>
              </SheetHeader>

              {/* Artwork image */}
              <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                <Image
                  src={selectedArtwork.thumbnailUrl}
                  alt={selectedArtwork.title}
                  fill
                  className="object-cover"
                  sizes="480px"
                />
                {selectedArtwork.isOrdinal && (
                  <Badge className="absolute top-3 left-3 bg-amber-500/80 text-white text-xs">
                    Ordinal
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedArtwork.description}
              </p>

              {/* Ownership section — only for inscribed ordinals */}
              {resolveArtworkOutpoint(selectedArtwork) && (
                connectedWallet ? (
                  ownedOutpoints.has(resolveArtworkOutpoint(selectedArtwork)!) ? (
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-emerald-300">You own this ordinal</span>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 gap-2"
                        onClick={() => { setSelectedArtwork(null); setClaimPanelOpen(true) }}
                      >
                        <Gift className="h-4 w-4" />
                        View Your Rewards
                      </Button>
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
                      Connect BSV Wallet
                    </Button>
                  </div>
                )
              )}

              {/* Buy actions */}
              <div className="flex flex-col gap-3 mt-auto">
                {/* Buy Print */}
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Printer className="h-4 w-4 text-sky-400" />
                      <span className="text-sm font-medium">Museum-quality print</span>
                    </div>
                    <span className="text-sm font-semibold rainbow-text">
                      CA${selectedArtwork.pricePrintCad}+
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Giclée prints, canvas wraps, and more. Shipped worldwide from ASMRprints.com.
                  </p>
                  <Button
                    onClick={() => openPrintModal(selectedArtwork)}
                    disabled={!selectedArtwork.printProducts.length}
                    className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Buy Print
                  </Button>
                </div>

                {/* Buy Ordinal — link to collection page */}
                {selectedArtwork.isOrdinal && (
                  <div className="glass rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gem className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">Own the 1Sat Ordinal</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Permanent on-chain provenance. Earn rewards every time a print sells.
                    </p>
                    <Link
                      href={`/c/${artistSlug}/${selectedArtwork.collectionSlug}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors text-sm"
                      onClick={() => setSelectedArtwork(null)}
                    >
                      <Gem className="h-4 w-4" />
                      View in Collection
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Holder claim panel ───────────────────────────────── */}
      {connectedWallet && (
        <HolderClaimPanel
          open={claimPanelOpen}
          onOpenChange={setClaimPanelOpen}
          collectionTitle={`${artistSlug} — all collections`}
          ordAddress={connectedWallet.ordAddress}
          bsvAddress={connectedWallet.bsvAddress}
          walletType={connectedWallet.type}
          ownedOrdinals={collectionOwnedOrdinals}
          balances={balances}
          artworks={claimArtworks}
        />
      )}

      {/* ── Shopify embed modal ──────────────────────────────── */}
      <ShopModal
        shopifyUrl={shopUrl}
        title={shopTitle}
        isOpen={shopModalOpen}
        onClose={() => setShopModalOpen(false)}
        printProducts={shopPrintProducts}
        onProductChange={(handle) =>
          setShopUrl(`https://canvas-cosmic-cart.chefmyklove.workers.dev/product/${handle}?embed=1`)
        }
      />
    </>
  )
}
