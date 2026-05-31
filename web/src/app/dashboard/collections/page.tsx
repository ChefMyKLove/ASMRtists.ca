import { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Plus, ImageIcon, Eye, Pencil, Layers } from 'lucide-react'

export const metadata: Metadata = { title: 'Collections — Dashboard' }

type CollectionStatus = 'draft' | 'pending_review' | 'active' | 'archived'

interface Collection {
  id: string
  title: string
  description: string | null
  status: CollectionStatus
  piece_count: number
  cover_image_url: string | null
  created_at: string
}

const STATUS_LABELS: Record<CollectionStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  active: 'Active',
  archived: 'Archived',
}

const STATUS_COLORS: Record<CollectionStatus, string> = {
  draft: 'bg-white/10 text-white/60',
  pending_review: 'bg-amber-500/20 text-amber-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  archived: 'bg-white/5 text-white/30',
}

function StatusBadge({ status }: { status: CollectionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
        STATUS_COLORS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  return (
    <div className="glass rounded-xl overflow-hidden flex flex-col">
      {/* Cover image area */}
      <div className="aspect-video bg-white/5 relative flex items-center justify-center">
        {collection.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={collection.cover_image_url}
            alt={collection.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/20">
            <ImageIcon className="h-10 w-10" />
            <span className="text-xs">No cover image</span>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={collection.status} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-sm truncate">{collection.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {collection.piece_count} {collection.piece_count === 1 ? 'piece' : 'pieces'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/collections/${collection.id}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 gap-1 text-xs')}
          >
            <Eye className="h-3 w-3" />
            View
          </Link>
          <Link
            href={`/dashboard/collections/${collection.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 text-xs')}
          >
            <Pencil className="h-3 w-3" />
            Manage
          </Link>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-xl p-12 flex flex-col items-center text-center gap-4">
      <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center">
        <ImageIcon className="h-8 w-8 text-white/20" />
      </div>
      <div>
        <h3 className="font-semibold text-sm">No collections yet</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Upload your first collection to get started. Once approved, your artwork will
          be listed for print sale and inscribed on-chain.
        </p>
      </div>
      <Link
        href="/dashboard/collections/upload"
        className={cn(buttonVariants({ size: 'sm' }), 'gap-1')}
      >
        <Plus className="h-4 w-4" />
        Upload your first collection
      </Link>
    </div>
  )
}

export default async function CollectionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Two-step lookup: auth user id → artist_profiles.id → collections
  const { data: artistProfile } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user!.id)
    .single()

  const { data: collections } = artistProfile
    ? await admin
        .from('collections')
        .select('id, title, description, status, piece_count, cover_image_url, created_at')
        .eq('artist_id', artistProfile.id)
        .order('created_at', { ascending: false })
    : { data: [] }

  const rows = (collections ?? []) as Collection[]

  // Status summary counts
  const counts = rows.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Collections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload and manage your artwork collections.
          </p>
        </div>
        <Link
          href="/dashboard/collections/upload"
          className={cn(buttonVariants(), 'flex items-center gap-1')}
        >
          <Plus className="h-4 w-4" />
          New Collection
        </Link>
      </div>

      {/* Status summary pills */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['draft', 'Draft'],
              ['pending_review', 'Pending Review'],
              ['active', 'Active'],
              ['archived', 'Archived'],
            ] as [CollectionStatus, string][]
          ).map(([status, label]) =>
            counts[status] ? (
              <span
                key={status}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  STATUS_COLORS[status]
                )}
              >
                {counts[status]} {label}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Collection grid or empty state */}
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </div>
  )
}
