import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageIcon, Send, Gem, ShoppingBag, Pencil, Star, ExternalLink } from 'lucide-react'
import { setCollectionCoverImageAction, updateCollectionDescriptionAction } from '@/app/actions/collections'

export const metadata: Metadata = { title: 'Collection — Dashboard' }

type CollectionStatus = 'draft' | 'pending_review' | 'active' | 'archived'

type ArtworkStatus = 'uploaded' | 'processing' | 'shop_pending' | 'shop_ready' | 'minting' | 'minted'

interface Artwork {
  id: string
  title: string
  subtitle: string | null
  position: number
  storage_path: string | null
  status: ArtworkStatus
  inscription_txid: string | null
}

interface Collection {
  id: string
  slug: string
  title: string
  description: string | null
  tags: string[]
  status: CollectionStatus
  piece_count: number
  cover_image_url: string | null
  created_at: string
}

const STATUS_COLORS: Record<CollectionStatus, string> = {
  draft: 'bg-white/10 text-white/60',
  pending_review: 'bg-amber-500/20 text-amber-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  archived: 'bg-white/5 text-white/30',
}

const STATUS_LABELS: Record<CollectionStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  active: 'Active',
  archived: 'Archived',
}

const ARTWORK_STATUS_COLORS: Record<ArtworkStatus, string> = {
  uploaded: 'bg-white/10 text-white/50',
  processing: 'bg-amber-500/20 text-amber-300',
  shop_pending: 'bg-blue-500/20 text-blue-300',
  shop_ready: 'bg-emerald-500/20 text-emerald-300',
  minting: 'bg-violet-500/20 text-violet-300',
  minted: 'bg-pink-500/20 text-pink-300',
}

const ARTWORK_STATUS_LABELS: Record<ArtworkStatus, string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  shop_pending: 'Shop Pending',
  shop_ready: 'Shop Ready',
  minting: 'Minting',
  minted: 'Minted',
}

function getStorageUrl(path: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/artwork-originals/${path}`
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Resolve artist_profiles.id (collections.artist_id references artist_profiles, not auth.users)
  const admin = createAdminClient()
  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) notFound()

  // Get the artist's username for building the public collection URL
  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  // Load collection — verified to belong to this artist
  const { data: collection } = await admin
    .from('collections')
    .select('id, slug, title, description, tags, status, piece_count, cover_image_url, created_at')
    .eq('id', id)
    .eq('artist_id', ap.id)
    .single()

  if (!collection) notFound()

  const coll = collection as Collection

  // Load artwork pieces
  const { data: artworkRows, error: artworkError } = await admin
    .from('artwork')
    .select('id, title, subtitle, position, storage_path, status, inscription_txid')
    .eq('collection_id', id)
    .order('position', { ascending: true })

  if (artworkError) console.error('[artwork query error]', artworkError.message)

  const artworks = (artworkRows ?? []) as Artwork[]

  // Pipeline summary
  const shopReadyCount = artworks.filter((a) => a.status === 'shop_ready').length
  const mintedCount = artworks.filter((a) => !!a.inscription_txid).length

  const username = profile?.username ?? null
  const publicUrl = username && coll.slug ? `/c/${username}/${coll.slug}` : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{coll.title}</h1>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                STATUS_COLORS[coll.status]
              )}
            >
              {STATUS_LABELS[coll.status]}
            </span>
            {publicUrl && (
              <Link
                href={publicUrl}
                className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View public page
              </Link>
            )}
          </div>

          <form
            action={async (formData: FormData) => {
              'use server'
              const desc = (formData.get('description') as string | null)?.trim() || null
              await updateCollectionDescriptionAction(id, desc)
            }}
            className="flex flex-col gap-1.5 max-w-prose"
          >
            <textarea
              name="description"
              defaultValue={coll.description ?? ''}
              rows={3}
              placeholder="Collection description…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/30 resize-none focus:outline-none focus:border-white/30"
            />
            <button
              type="submit"
              className="self-start text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
            >
              Save description
            </button>
          </form>

          {Array.isArray(coll.tags) && coll.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {coll.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {coll.status === 'draft' && (
          <form
            action={async () => {
              'use server'
              const srv = await createClient()
              await srv
                .from('collections')
                .update({ status: 'pending_review' })
                .eq('id', id)
            }}
          >
            <button
              type="submit"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1 flex-shrink-0')}
            >
              <Send className="h-4 w-4" />
              Submit for Review
            </button>
          </form>
        )}
      </div>

      {/* Pipeline summary */}
      <div className="glass rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold rainbow-text">{coll.piece_count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total pieces</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {shopReadyCount}
            <span className="text-sm text-white/40 font-normal"> / {coll.piece_count}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <ShoppingBag className="h-3 w-3" />
            Listed on Shopify
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-pink-400">
            {mintedCount}
            <span className="text-sm text-white/40 font-normal"> / {coll.piece_count}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
            <Gem className="h-3 w-3" />
            Ordinals minted
          </p>
        </div>
      </div>

      {/* Artwork grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Artwork</h2>
          {coll.piece_count < 64 && (
            <Link
              href={`/dashboard/collections/${id}/artwork`}
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'gap-1.5 border-white/20 hover:bg-white/5')}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Add Artwork
            </Link>
          )}
        </div>
        {artworks.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No artwork uploaded yet.</p>
            <Link
              href={`/dashboard/collections/${id}/artwork`}
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Upload Artwork
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {artworks.map((art) => {
              const imgUrl = getStorageUrl(art.storage_path)
              const isCover = imgUrl !== null && imgUrl === coll.cover_image_url
              return (
                <div key={art.id} className={cn('glass rounded-xl overflow-hidden flex flex-col', isCover && 'ring-1 ring-amber-400/60')}>
                  <div className="relative aspect-square bg-white/5">
                    {imgUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgUrl}
                        alt={art.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/20">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      #{art.position}
                    </span>
                    {isCover && (
                      <span className="absolute top-1 right-1 flex items-center gap-0.5 bg-amber-500/80 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                        <Star className="h-2.5 w-2.5" />
                        Cover
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{art.title}</p>
                        {art.subtitle && (
                          <p className="text-[10px] text-white/50 truncate">{art.subtitle}</p>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/collections/${id}/artwork/${art.id}`}
                        className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors"
                        title="Edit metadata"
                      >
                        <Pencil className="h-3 w-3" />
                      </Link>
                    </div>
                    <span
                      className={cn(
                        'inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
                        ARTWORK_STATUS_COLORS[art.status]
                      )}
                    >
                      {ARTWORK_STATUS_LABELS[art.status]}
                    </span>
                    {art.inscription_txid && (
                      <p className="text-[10px] text-pink-400 font-mono truncate" title={art.inscription_txid}>
                        txid: {art.inscription_txid.slice(0, 12)}…
                      </p>
                    )}
                    {imgUrl && !isCover && (
                      <form
                        action={async () => {
                          'use server'
                          await setCollectionCoverImageAction(id, imgUrl)
                        }}
                      >
                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-1 text-[10px] text-white/40 hover:text-amber-400 transition-colors py-0.5"
                        >
                          <Star className="h-2.5 w-2.5" />
                          Set as Cover
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Back link */}
      <div>
        <Link
          href="/dashboard/collections"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          Back to Collections
        </Link>
      </div>
    </div>
  )
}
