import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ExternalLink, Hash, Wand2, Gem, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PrepareButton } from './prepare-button'

export const metadata: Metadata = { title: 'Ordinals — Dashboard' }

function storageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/artwork-originals/${encoded}`
}

function truncate(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-8)}`
}

export default async function OrdinalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()

  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!ap) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Ordinals</h1>
          <p className="text-muted-foreground text-sm mt-1">BSV ordinals inscribed from your artwork.</p>
        </div>
        <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">
          No artist profile found.
        </div>
      </div>
    )
  }

  const { data: allArtwork } = await admin
    .from('artwork')
    .select('id, title, position, storage_path, jpeg_storage_path, inscription_txid, inscription_outpoint, collection_id, status, error_message')
    .eq('artist_id', ap.id)
    .order('position')

  const artworks = allArtwork ?? []

  // Error / in-progress buckets
  const errored = artworks.filter(a => a.status === 'error' || a.status === 'mint_error')
  const processing = artworks.filter(a => a.status === 'processing' || a.status === 'minting' || a.status === 'shop_pending')
  const errorIds = new Set([...errored, ...processing].map(a => a.id))

  // Stage 1: needs JPEG prep (no jpeg_storage_path, no txid)
  const needsPrep = artworks.filter(a => !a.jpeg_storage_path && !a.inscription_txid && !errorIds.has(a.id))
  // Stage 2: JPEG ready but not yet minted (jpeg exists, no txid)
  const readyToMint = artworks.filter(a => a.jpeg_storage_path && !a.inscription_txid && !errorIds.has(a.id))
  // Stage 3: fully minted
  const minted = artworks.filter(a => !!a.inscription_txid)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ordinals</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage BSV on-chain inscriptions for your artwork.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <p><span className="text-emerald-400 font-medium">{minted.length}</span> minted</p>
          <p><span className="text-violet-400 font-medium">{readyToMint.length}</span> ready</p>
          <p><span className="text-white/40">{needsPrep.length}</span> need prep</p>
          {processing.length > 0 && <p><span className="text-amber-400 font-medium">{processing.length}</span> processing</p>}
          {errored.length > 0 && <p><span className="text-red-400 font-medium">{errored.length}</span> errored</p>}
        </div>
      </div>

      {/* ── Pipeline steps ─────────────────────────────────────── */}
      <div className="glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-[10px] font-bold">1</span>
          <span>Prepare JPEG</span>
        </div>
        <span className="hidden sm:block text-white/20">→</span>
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">2</span>
          <span>List for collectors</span>
        </div>
        <span className="hidden sm:block text-white/20">→</span>
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">3</span>
          <span>Minted on-chain</span>
        </div>
      </div>

      {/* ── Processing ──────────────────────────────────────────── */}
      {processing.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
            <h2 className="text-sm font-semibold text-white/80">Pipeline Running</h2>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px]">
              {processing.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {processing.map(art => (
              <div key={art.id} className="glass rounded-xl overflow-hidden border border-amber-500/20">
                {art.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageUrl(art.storage_path)}
                    alt={art.title}
                    className="w-full aspect-square object-cover opacity-40"
                  />
                )}
                <div className="p-3 space-y-1.5">
                  <p className="font-medium text-sm truncate">{art.title}</p>
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px]">
                    {art.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground">Refresh to check progress</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Errors ──────────────────────────────────────────────── */}
      {errored.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-white/80">Pipeline Errors</h2>
            <Badge className="bg-red-500/15 text-red-300 border-red-500/25 text-[10px]">
              {errored.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These pieces encountered errors during processing. Contact support or retry by re-approving the collection.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {errored.map(art => (
              <div key={art.id} className="glass rounded-xl overflow-hidden border border-red-500/20">
                {art.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageUrl(art.storage_path)}
                    alt={art.title}
                    className="w-full aspect-square object-cover opacity-40"
                  />
                )}
                <div className="p-3 space-y-1.5">
                  <p className="font-medium text-sm truncate">{art.title}</p>
                  <Badge className="bg-red-500/15 text-red-300 border-red-500/25 text-[10px]">
                    {art.status}
                  </Badge>
                  {art.error_message && (
                    <p className="text-xs text-red-300/70 font-mono break-all">
                      {art.error_message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Stage 1: Needs Preparation ─────────────────────────── */}
      {needsPrep.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white/80">Step 1 — Needs Preparation</h2>
            <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/25 text-[10px]">
              {needsPrep.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These pieces need their source image converted to an inscription-optimised JPEG before they can be listed for collector minting.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsPrep.map(art => (
              <div key={art.id} className="glass rounded-xl overflow-hidden">
                {art.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageUrl(art.storage_path)}
                    alt={art.title}
                    className="w-full aspect-square object-cover opacity-60"
                  />
                )}
                <div className="p-3 space-y-2.5">
                  <div>
                    <p className="font-medium text-sm truncate">{art.title}</p>
                    <p className="text-xs text-muted-foreground">Piece #{art.position}</p>
                  </div>
                  <PrepareButton artworkId={art.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Stage 2: Ready to List ─────────────────────────────── */}
      {readyToMint.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gem className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white/80">Step 2 — Ready for Collector Minting</h2>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px]">
              {readyToMint.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            JPEG is prepared. These pieces will show a &ldquo;Mint Ordinal&rdquo; button to collectors on your public collection page. Once a collector purchases, the ordinal will be inscribed to their BSV address and the inscription TxID will be recorded here.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyToMint.map(art => (
              <div key={art.id} className="glass rounded-xl overflow-hidden">
                {art.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageUrl(art.storage_path)}
                    alt={art.title}
                    className="w-full aspect-square object-cover"
                  />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{art.title}</p>
                      <p className="text-xs text-muted-foreground">Piece #{art.position}</p>
                    </div>
                    <Badge className="flex-shrink-0 bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px]">
                      Ready
                    </Badge>
                  </div>
                  <Link
                    href={`/dashboard/collections/${art.collection_id}/artwork/${art.id}`}
                    className="block text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    Edit / set price →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Stage 3: Minted ───────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white/80">Minted On-Chain</h2>
          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/25 text-[10px]">
            {minted.length}
          </Badge>
        </div>

        {minted.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center space-y-2">
            <p className="text-muted-foreground text-sm">No ordinals minted yet.</p>
            <p className="text-xs text-muted-foreground">
              Prepare your pieces above and collectors will be able to mint them from your public collection page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {minted.map(art => (
              <div key={art.id} className="glass rounded-xl overflow-hidden group">
                {art.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={storageUrl(art.storage_path)}
                    alt={art.title}
                    className="w-full aspect-square object-cover"
                  />
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{art.title}</p>
                      <p className="text-xs text-muted-foreground">Piece #{art.position}</p>
                    </div>
                    <a
                      href={`https://whatsonchain.com/tx/${art.inscription_txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-muted-foreground hover:text-white transition-colors"
                      title="View on WhatsOnChain"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-white/40 bg-white/5 rounded px-2 py-1">
                    <Hash className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate" title={art.inscription_txid ?? undefined}>
                      {truncate(art.inscription_txid!)}
                    </span>
                  </div>
                  {art.inscription_outpoint && (
                    <Link
                      href={`/ordinals#list`}
                      className="block text-center text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 rounded-md py-1.5 transition-colors"
                      title={`Outpoint: ${art.inscription_outpoint}`}
                    >
                      List for Sale → connect wallet on marketplace
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Empty state — no artwork at all */}
      {artworks.length === 0 && (
        <div className="glass rounded-xl p-8 text-center space-y-2">
          <p className="text-muted-foreground text-sm">No artwork found.</p>
          <p className="text-xs text-muted-foreground">
            Upload artwork in your{' '}
            <Link href="/dashboard/collections" className="text-violet-400 hover:text-violet-300 underline">
              collections
            </Link>{' '}
            to get started.
          </p>
        </div>
      )}
    </div>
  )
}
