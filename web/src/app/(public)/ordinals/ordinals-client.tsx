'use client'

import { useState } from 'react'
import Link from 'next/link'
import { WalletConnector } from '@/components/wallet/wallet-connector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { mintOrdinalAction, createListingAction, confirmListingEscrow, purchaseListingAction } from '@/app/actions/ordinals'
import type { WalletConnection } from '@/lib/wallet/connectors'
import type { MintableItem, ListingItem, OwnableItem } from './page'
import {
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Gem,
  ShoppingBag,
} from 'lucide-react'
import { truncateAddress } from '@/lib/utils'

interface Props {
  mintable: MintableItem[]
  listings: ListingItem[]
  ownableItems: OwnableItem[]
}

type MintState =
  | { status: 'idle' }
  | { status: 'minting' }
  | { status: 'done'; txid: string; outpoint: string }
  | { status: 'error'; message: string }

export function OrdinalsClient({ mintable, listings, ownableItems }: Props) {
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [mintStates, setMintStates] = useState<Record<string, MintState>>({})
  const [listForm, setListForm] = useState({
    outpoint: '',
    price: '',
    loading: false,
    error: '',
    success: false,
  })
  const [myOrdinals, setMyOrdinals] = useState<OwnableItem[]>([])
  const [checkingOwnership, setCheckingOwnership] = useState(false)

  function setMintState(id: string, state: MintState) {
    setMintStates((prev) => ({ ...prev, [id]: state }))
  }

  async function handleWalletConnect(conn: WalletConnection) {
    setWallet(conn)
    if (!ownableItems.length) return
    setCheckingOwnership(true)
    try {
      const res = await fetch('/api/ordinals/check-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outpoints: ownableItems.map((o) => o.inscription_outpoint),
          addresses: [conn.ordAddress, conn.bsvAddress].filter(Boolean),
        }),
      })
      if (res.ok) {
        const data = await res.json() as { ownedOutpoints?: string[] }
        const owned = new Set(data.ownedOutpoints ?? [])
        setMyOrdinals(ownableItems.filter((o) => owned.has(o.inscription_outpoint)))
      }
    } catch {
      // non-fatal
    } finally {
      setCheckingOwnership(false)
    }
  }

  async function handleMint(artworkId: string) {
    if (!wallet) return
    setMintState(artworkId, { status: 'minting' })
    const result = await mintOrdinalAction(artworkId, wallet.ordAddress)
    if (result.ok && result.txid && result.outpoint) {
      setMintState(artworkId, { status: 'done', txid: result.txid, outpoint: result.outpoint })
    } else {
      setMintState(artworkId, { status: 'error', message: result.error ?? 'Mint failed' })
    }
  }

  async function handleList() {
    if (!wallet || !listForm.outpoint.trim() || !listForm.price) return
    const price = parseFloat(listForm.price)
    if (isNaN(price) || price <= 0) {
      setListForm((f) => ({ ...f, error: 'Enter a valid price' })); return
    }
    setListForm((f) => ({ ...f, loading: true, error: '' }))
    const rawOutpoint = listForm.outpoint.trim()
    const normalizedOutpoint = /^[0-9a-f]{64}$/i.test(rawOutpoint) ? `${rawOutpoint}_0` : rawOutpoint
    const result = await createListingAction(normalizedOutpoint, price, wallet.ordAddress, wallet.bsvAddress)
    if (!result.ok || !result.listingId || !result.escrowAddress) {
      setListForm((f) => ({ ...f, loading: false, error: result.error ?? 'Failed to create listing' })); return
    }

    // Transfer ordinal to escrow via wallet
    const yours = (window.yours ?? (window as any).YoursWallet) as (typeof window.yours) | undefined
    if (!yours?.sendOrdinals) {
      setListForm((f) => ({ ...f, loading: false, error: 'Yours Wallet sendOrdinals not available — update your wallet extension' })); return
    }

    let escrowTxids: string[]
    try {
      escrowTxids = await yours.sendOrdinals({
        address: result.escrowAddress,
        outpoints: [normalizedOutpoint],
      })
    } catch (err) {
      setListForm((f) => ({ ...f, loading: false, error: err instanceof Error ? err.message : 'Wallet rejected the transfer' })); return
    }

    const escrowTxid = escrowTxids[0]
    if (!escrowTxid) {
      setListForm((f) => ({ ...f, loading: false, error: 'Wallet did not return a txid' })); return
    }

    const confirm = await confirmListingEscrow(result.listingId, escrowTxid)
    if (!confirm.ok) {
      setListForm((f) => ({ ...f, loading: false, error: confirm.error ?? 'Could not confirm escrow' })); return
    }

    setListForm({ outpoint: '', price: '', loading: false, error: '', success: true })
  }

  const mintedIds = new Set(
    Object.entries(mintStates)
      .filter(([, s]) => s.status === 'done')
      .map(([id]) => id)
  )
  const visibleMintable = mintable.filter((a) => !mintedIds.has(a.id))

  return (
    <div className="space-y-16">
      {/* ── Page header + wallet ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordinals Marketplace</h1>
          <p className="text-muted-foreground mt-1.5 max-w-xl">
            Mint first-edition BSV ordinals from council-approved artists, or pick up
            pieces listed by collectors.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <WalletConnector
            onConnected={handleWalletConnect}
            onDisconnected={() => setWallet(null)}
          />
          {!wallet && (
            <Link
              href="/get-started"
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              No wallet? Create a profile →
            </Link>
          )}
        </div>
      </div>

      {/* ── Section 1: Mint Originals ────────────────────────────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Gem className="h-4 w-4 text-violet-400" />
          <h2 className="text-lg font-semibold">Mint Originals</h2>
          <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/25 text-[10px]">
            {visibleMintable.length}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          First-edition inscriptions — each piece is minted exactly once to your BSV address.
        </p>

        {visibleMintable.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
            No originals available right now. Check back after the next council review.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visibleMintable.map((item) => {
              const state = mintStates[item.id] ?? { status: 'idle' }
              return (
                <MintCard
                  key={item.id}
                  item={item}
                  wallet={wallet}
                  state={state}
                  onMint={() => handleMint(item.id)}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Listed for Sale ───────────────────────────────── */}
      {listings.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <h2 className="text-lg font-semibold">Listed for Sale</h2>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px]">
              {listings.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Collector-owned ordinals available for resale.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} wallet={wallet} />
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Your Ordinals (wallet-detected) ───────────────── */}
      {wallet && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-400" />
            <h2 className="text-lg font-semibold">Your Ordinals</h2>
            {checkingOwnership && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {checkingOwnership ? (
            <p className="text-sm text-muted-foreground">Checking your wallet for ASMRtists ordinals…</p>
          ) : myOrdinals.length === 0 ? (
            <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
              No ASMRtists ordinals found in this wallet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {myOrdinals.map((item) => (
                <OwnedOrdinalCard
                  key={item.id}
                  item={item}
                  wallet={wallet}
                  onListed={() => setMyOrdinals((prev) => prev.filter((o) => o.id !== item.id))}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Section 4: List Your Ordinal (manual fallback) ───────────── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-emerald-400/50" />
          <h2 className="text-lg font-semibold text-foreground/60">List by Outpoint</h2>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Have an ordinal that wasn&apos;t detected above? Paste the outpoint manually.
          Format: <span className="font-mono text-xs">txid_0</span>
        </p>

        {!wallet ? (
          <div className="glass rounded-xl p-6 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Connect your BSV wallet to list an ordinal for sale.
            </p>
            <WalletConnector
              onConnected={handleWalletConnect}
              onDisconnected={() => setWallet(null)}
            />
          </div>
        ) : listForm.success ? (
          <div className="glass rounded-xl p-6 flex items-center gap-3 text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Listing created successfully</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ordinal secured in escrow — your listing is now live.
              </p>
              <button
                className="text-xs text-violet-400 hover:text-violet-300 mt-2"
                onClick={() => setListForm((f) => ({ ...f, success: false }))}
              >
                List another
              </button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-6 space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Inscription outpoint
              </label>
              <Input
                placeholder="txid_0"
                value={listForm.outpoint}
                onChange={(e) => setListForm((f) => ({ ...f, outpoint: e.target.value }))}
                className="font-mono text-sm bg-white/5 border-white/10"
                disabled={listForm.loading}
              />
              <p className="text-[11px] text-white/30">
                Format: <span className="font-mono">txid_vout</span> — find it on 1sat.app or WoC
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Price (MNEE)
              </label>
              <Input
                type="number"
                min="0.0001"
                step="0.01"
                placeholder="e.g. 25.00"
                value={listForm.price}
                onChange={(e) => setListForm((f) => ({ ...f, price: e.target.value }))}
                className="text-sm bg-white/5 border-white/10"
                disabled={listForm.loading}
              />
            </div>
            {listForm.error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {listForm.error}
              </p>
            )}
            <Button
              className="w-full"
              disabled={listForm.loading || !listForm.outpoint.trim() || !listForm.price}
              onClick={handleList}
            >
              {listForm.loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verifying ownership…
                </>
              ) : (
                'Create Listing'
              )}
            </Button>
            <p className="text-[11px] text-white/30">
              Listing as{' '}
              <span className="font-mono">{truncateAddress(wallet.ordAddress, 6)}</span>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── OwnedOrdinalCard ────────────────────────────────────────────────────────

type ListStage = 'idle' | 'db' | 'escrow' | 'confirming' | 'done' | 'error'

function OwnedOrdinalCard({
  item,
  wallet,
  onListed,
}: {
  item: OwnableItem
  wallet: WalletConnection
  onListed: () => void
}) {
  const [price, setPrice] = useState('')
  const [stage, setStage] = useState<ListStage>('idle')
  const [error, setError] = useState('')

  async function handleList() {
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) { setError('Enter a valid price'); return }
    setStage('db'); setError('')

    // 1. Create DB listing — returns listingId + escrow address
    const result = await createListingAction(item.inscription_outpoint, p, wallet.ordAddress, wallet.bsvAddress)
    if (!result.ok || !result.listingId || !result.escrowAddress) {
      setStage('error'); setError(result.error ?? 'Failed to create listing'); return
    }

    setStage('escrow')

    // 2. Transfer ordinal to platform escrow via Yours Wallet
    const yours = (window.yours ?? (window as any).YoursWallet) as (typeof window.yours) | undefined
    if (!yours?.sendOrdinals) {
      setStage('error'); setError('Yours Wallet sendOrdinals not available — update your wallet extension'); return
    }

    let escrowTxids: string[]
    try {
      escrowTxids = await yours.sendOrdinals({
        address: result.escrowAddress,
        outpoints: [item.inscription_outpoint],
      })
    } catch (err) {
      setStage('error'); setError(err instanceof Error ? err.message : 'Wallet rejected the transfer'); return
    }

    const escrowTxid = escrowTxids[0]
    if (!escrowTxid) { setStage('error'); setError('Wallet did not return a txid'); return }

    setStage('confirming')

    // 3. Record escrow txid → listing goes live
    const confirm = await confirmListingEscrow(result.listingId, escrowTxid)
    if (!confirm.ok) {
      setStage('error'); setError(confirm.error ?? 'Could not confirm escrow'); return
    }

    setStage('done'); onListed()
  }

  const stageLabel: Record<ListStage, string> = {
    idle: 'List for Sale',
    db: 'Creating listing…',
    escrow: 'Approve transfer in wallet…',
    confirming: 'Confirming…',
    done: 'Listed!',
    error: 'List for Sale',
  }

  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-white/5 relative overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Tag className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            by{' '}
            <Link href={`/c/${item.artist.username}`} className="hover:text-white transition-colors">
              {item.artist.displayName}
            </Link>
          </p>
        </div>
        {stage === 'done' ? (
          <div className="flex items-center gap-1.5 text-emerald-300 text-xs mt-auto">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Listed — ordinal secured in escrow
          </div>
        ) : (
          <div className="mt-auto space-y-2">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Price in MNEE"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="h-8 text-xs bg-white/5 border-white/10"
              disabled={stage !== 'idle' && stage !== 'error'}
            />
            {error && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />{error}
              </p>
            )}
            <Button
              size="sm"
              className="w-full"
              onClick={handleList}
              disabled={(stage !== 'idle' && stage !== 'error') || !price}
            >
              {(stage === 'db' || stage === 'escrow' || stage === 'confirming')
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{stageLabel[stage]}</>
                : stageLabel[stage]
              }
            </Button>
            {stage === 'escrow' && (
              <p className="text-[10px] text-amber-300/70">
                Your wallet will prompt you to approve sending the ordinal to platform escrow.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MintCard ─────────────────────────────────────────────────────────────────

function MintCard({
  item,
  wallet,
  state,
  onMint,
}: {
  item: MintableItem
  wallet: WalletConnection | null
  state: MintState
  onMint: () => void
}) {
  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      {/* Thumbnail */}
      <div className="aspect-square bg-white/5 relative overflow-hidden">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Gem className="h-8 w-8" />
          </div>
        )}
        {item.ordinal_price_mnee && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-black/60 text-white border-white/10 text-[10px] backdrop-blur">
              {item.ordinal_price_mnee} MNEE
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            by{' '}
            <Link
              href={`/c/${item.artist.username}`}
              className="hover:text-white transition-colors"
            >
              {item.artist.displayName}
            </Link>
            {' · '}
            <Link
              href={`/c/${item.artist.username}/${item.collection.slug}`}
              className="hover:text-white transition-colors"
            >
              {item.collection.title}
            </Link>
          </p>
        </div>

        <div className="mt-auto">
          {state.status === 'done' ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Minted!</span>
              </div>
              <a
                href={`https://whatsonchain.com/tx/${state.txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-mono text-white/40 hover:text-white/70 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                {state.txid.slice(0, 10)}…
              </a>
            </div>
          ) : state.status === 'error' ? (
            <div className="text-xs text-red-400 flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{state.message}</span>
            </div>
          ) : !wallet ? (
            <WalletConnector />
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={state.status === 'minting'}
              onClick={onMint}
            >
              {state.status === 'minting' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Minting…
                </>
              ) : (
                'Mint Now'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── ListingCard ──────────────────────────────────────────────────────────────

type BuyStage = 'idle' | 'paying' | 'delivering' | 'done' | 'error'

function ListingCard({
  listing,
  wallet,
}: {
  listing: ListingItem
  wallet: WalletConnection | null
}) {
  const [stage, setStage] = useState<BuyStage>('idle')
  const [error, setError] = useState('')
  const [saleTxid, setSaleTxid] = useState('')

  async function handleBuy() {
    if (!wallet) return
    setStage('paying'); setError('')

    const yours = (window.yours ?? (window as any).YoursWallet) as (typeof window.yours) | undefined
    if (!yours?.sendBsv) {
      setStage('error'); setError('Yours Wallet not available — update your wallet extension'); return
    }

    // Send price_mnee value as satoshis to seller (placeholder until MNEE token payment)
    const totalSats = Math.max(1, Math.floor(Number(listing.price_mnee)))
    let paymentTxid: string
    try {
      paymentTxid = await yours.sendBsv([
        { address: listing.seller_ord_address, satoshis: totalSats },
      ])
    } catch (err) {
      setStage('error'); setError(err instanceof Error ? err.message : 'Payment rejected'); return
    }

    setStage('delivering')

    const result = await purchaseListingAction(listing.id, wallet.ordAddress, paymentTxid)
    if (!result.ok) {
      setStage('error'); setError(result.error ?? 'Delivery failed'); return
    }

    setSaleTxid(result.saleTxid ?? '')
    setStage('done')
  }

  const stageLabel: Record<BuyStage, string> = {
    idle: `Buy Now — ${listing.price_mnee} MNEE`,
    paying: 'Approve payment in wallet…',
    delivering: 'Delivering ordinal…',
    done: 'Purchased!',
    error: `Buy Now — ${listing.price_mnee} MNEE`,
  }

  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-white/5 relative overflow-hidden">
        {listing.artwork.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.artwork.thumbnailUrl}
            alt={listing.artwork.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <ShoppingBag className="h-8 w-8" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge className="bg-amber-500/80 text-white border-transparent text-[10px]">
            {listing.price_mnee} MNEE
          </Badge>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{listing.artwork.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            by{' '}
            <Link
              href={`/c/${listing.artwork.artist.username}`}
              className="hover:text-white transition-colors"
            >
              {listing.artwork.artist.displayName}
            </Link>
          </p>
          <p className="text-[11px] text-white/30 font-mono mt-0.5 truncate">
            Seller: {truncateAddress(listing.seller_ord_address, 5)}
          </p>
        </div>

        <div className="mt-auto">
          {stage === 'done' ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Ordinal delivered to your wallet!</span>
              </div>
              {saleTxid && (
                <a
                  href={`https://whatsonchain.com/tx/${saleTxid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-mono text-white/40 hover:text-white/70 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  {saleTxid.slice(0, 10)}…
                </a>
              )}
            </div>
          ) : !wallet ? (
            <WalletConnector />
          ) : (
            <>
              {error && (
                <p className="text-[10px] text-red-400 flex items-center gap-1 mb-1.5">
                  <AlertCircle className="h-3 w-3 shrink-0" />{error}
                </p>
              )}
              <Button
                size="sm"
                className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30"
                disabled={stage !== 'idle' && stage !== 'error'}
                onClick={handleBuy}
              >
                {(stage === 'paying' || stage === 'delivering')
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{stageLabel[stage]}</>
                  : stageLabel[stage]
                }
              </Button>
              {stage === 'paying' && (
                <p className="text-[10px] text-amber-300/70 mt-1">
                  Approve the BSV payment in your Yours Wallet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
