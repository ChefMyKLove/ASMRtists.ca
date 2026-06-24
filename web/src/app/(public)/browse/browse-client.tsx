'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArtistCard } from '@/components/gallery/artist-card'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'featured' | 'prints' | 'ordinals'

interface Artist {
  slug: string
  displayName: string
  bio?: string | null
  artworkCount: number
  isFeatured?: boolean
  hasPrints?: boolean
  hasOrdinals?: boolean
  collectionName?: string
  curatorName?: string
  bannerUrl?: string | null
  avatarUrl?: string | null
}

interface Collection {
  id: string
  title: string
  slug: string
  artistSlug: string
  artistName: string
  coverImageUrl: string | null
  pieceCount: number
}

interface BrowseClientProps {
  artists: Artist[]
  collections: Collection[]
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'featured', label: 'Featured' },
  { value: 'prints', label: 'Available as Print' },
  { value: 'ordinals', label: 'Available as Ordinal' },
]

export function BrowseClient({ artists, collections }: BrowseClientProps) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  const filtered = useMemo(() => {
    let result = artists

    if (activeFilter === 'featured') result = result.filter((a) => a.isFeatured)
    if (activeFilter === 'prints') result = result.filter((a) => a.hasPrints)
    if (activeFilter === 'ordinals') result = result.filter((a) => a.hasOrdinals)

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.bio?.toLowerCase().includes(q) ||
          a.collectionName?.toLowerCase().includes(q) ||
          a.curatorName?.toLowerCase().includes(q)
      )
    }

    return result
  }, [artists, activeFilter, query])

  return (
    <div className="space-y-6">
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search artists, collections…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 placeholder:text-muted-foreground focus-visible:ring-white/20"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                activeFilter === f.value
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-white'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? 'artist' : 'artists'} found
      </p>

      {/* Artist grid — responsive 1→2→3→4 */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-sm">No artists match your search.</p>
          <button
            type="button"
            onClick={() => { setQuery(''); setActiveFilter('all') }}
            className="mt-2 text-xs text-white/60 hover:text-white transition-colors underline underline-offset-4"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((artist, index) => (
            <div key={artist.slug} className="relative">
              <ArtistCard {...artist} priority={index === 0} />
              {/* Badges overlaid on card bottom */}
              <div className="absolute bottom-[4.5rem] left-4 flex gap-1.5 pointer-events-none">
                {artist.hasPrints && (
                  <Badge className="bg-sky-500/80 text-white text-[10px] py-0 px-1.5">
                    Print
                  </Badge>
                )}
                {artist.hasOrdinals && (
                  <Badge className="bg-amber-500/80 text-white text-[10px] py-0 px-1.5">
                    Ordinal
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collections section */}
      {collections.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Collections</h2>
            <span className="text-xs text-muted-foreground">{collections.length} active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/c/${col.artistSlug}/${col.slug}`}
                className="group block"
              >
                <div className="glass rounded-xl overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
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
                  <div className="p-3 space-y-0.5">
                    <p className="text-sm font-medium truncate group-hover:text-white transition-colors">
                      {col.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{col.artistName}</p>
                    <p className="text-xs text-white/40">
                      {col.pieceCount} {col.pieceCount === 1 ? 'piece' : 'pieces'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
