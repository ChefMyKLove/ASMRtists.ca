import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface Artwork {
  id: string
  title: string
  thumbnailUrl?: string | null
  artistName: string
  artistSlug: string
  priceCad?: number | null
  isOrdinal?: boolean
}

interface ArtworkGridProps {
  artworks: Artwork[]
  columns?: 2 | 3 | 4
}

export function ArtworkGrid({ artworks, columns = 3 }: ArtworkGridProps) {
  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  }[columns]

  if (artworks.length === 0) {
    return (
      <div className="col-span-full py-16 text-center text-muted-foreground">
        <p className="text-sm">No artworks found.</p>
      </div>
    )
  }

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {artworks.map((artwork) => (
        <Card key={artwork.id} className="glass overflow-hidden group hover:ring-1 hover:ring-white/20 transition-all">
          <div className="relative aspect-square bg-white/5">
            {artwork.thumbnailUrl ? (
              <Image
                src={artwork.thumbnailUrl}
                alt={artwork.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl text-white/10">?</span>
              </div>
            )}
            {artwork.isOrdinal && (
              <Badge className="absolute top-2 left-2 bg-amber-500/80 text-white text-xs">
                Ordinal
              </Badge>
            )}
          </div>

          <CardContent className="p-3">
            <p className="text-sm font-medium truncate">{artwork.title}</p>
            <Link
              href={`/artists/${artwork.artistSlug}`}
              className="text-xs text-muted-foreground hover:text-white transition-colors"
            >
              {artwork.artistName}
            </Link>
            {artwork.priceCad != null && (
              <p className="text-sm font-semibold mt-1 rainbow-text">
                {formatCurrency(artwork.priceCad)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
