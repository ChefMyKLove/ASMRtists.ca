'use client'

import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { Printer, Gem, Wallet, ExternalLink, Copy, Check } from 'lucide-react'

interface Artwork {
  id: string
  title: string
  description: string
  thumbnailUrl: string
  pricePrintCad: number
  priceOrdinalMnee: number
  shopifyHandle: string
  inscriptionId?: string
  isOrdinal: boolean
}

interface Ordinal {
  id: string
  title: string
  thumbnailUrl: string
  inscriptionId: string
  outpoint: string
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  holderCount: number
}

interface ArtistPageClientProps {
  artworks: Artwork[]
  ordinals: Ordinal[]
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

export function ArtistPageClient({ artworks, ordinals }: ArtistPageClientProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)
  const [shopModalOpen, setShopModalOpen] = useState(false)
  const [shopUrl, setShopUrl] = useState('')
  const [shopTitle, setShopTitle] = useState('')
  const [walletConnected] = useState(false) // TODO: wire to real wallet state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function openPrintModal(artwork: Artwork) {
    const url = `https://asmrprints.com/product/${artwork.shopifyHandle}?embed=1`
    setShopUrl(url)
    setShopTitle(`${artwork.title} — Print`)
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
      <Tabs defaultValue="gallery" className="pb-16">
        <TabsList className="mb-6 bg-white/5">
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
              {ordinals.map((ordinal) => (
                <Card key={ordinal.id} className="glass overflow-hidden">
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
                  </CardContent>
                </Card>
              ))}
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
                    className="w-full bg-white text-black hover:bg-white/90"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Buy Print
                  </Button>
                </div>

                {/* Buy Ordinal */}
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gem className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-medium">Own the 1Sat Ordinal</span>
                    </div>
                    <span className="text-sm font-semibold rainbow-text">
                      {selectedArtwork.priceOrdinalMnee} MNEE
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Permanent on-chain provenance. Transfers atomically with payment.
                  </p>

                  {walletConnected ? (
                    <div className="space-y-2">
                      {selectedArtwork.inscriptionId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Inscription: {truncateId(selectedArtwork.inscriptionId)}
                        </p>
                      )}
                      <Button
                        className="w-full"
                        disabled={!selectedArtwork.isOrdinal}
                        variant={selectedArtwork.isOrdinal ? 'default' : 'outline'}
                      >
                        <Gem className="h-4 w-4 mr-2" />
                        {selectedArtwork.isOrdinal ? 'Buy Ordinal' : 'Not yet minted'}
                      </Button>
                    </div>
                  ) : (
                    // TODO: wire to real wallet connect flow
                    <Button
                      variant="outline"
                      className="w-full border-white/20 hover:bg-white/5"
                      onClick={() => { /* TODO: open wallet connect flow */ }}
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Connect BSV Wallet
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Shopify embed modal ──────────────────────────────── */}
      <ShopModal
        shopifyUrl={shopUrl}
        title={shopTitle}
        isOpen={shopModalOpen}
        onClose={() => setShopModalOpen(false)}
      />
    </>
  )
}
