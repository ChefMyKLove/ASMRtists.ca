'use client'

import { ArtworkCard } from './artwork-card'
import type { CollectionArtwork } from './types'

interface CollectionGridProps {
  artworks: CollectionArtwork[]
  onSelect: (artwork: CollectionArtwork) => void
  ownedOutpoints?: Set<string>
}

export function CollectionGrid({ artworks, onSelect, ownedOutpoints }: CollectionGridProps) {
  const sorted = [...artworks].sort((a, b) => a.position - b.position)

  if (sorted.length === 0) {
    return (
      <div className="py-24 text-center text-muted-foreground text-sm">
        No pieces in this collection yet.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
      {sorted.map((artwork) => (
        <ArtworkCard
          key={artwork.id}
          artwork={artwork}
          onClick={() => onSelect(artwork)}
          isOwned={
            ownedOutpoints !== undefined &&
            artwork.inscription_outpoint !== null &&
            artwork.inscription_outpoint !== undefined &&
            ownedOutpoints.has(artwork.inscription_outpoint)
          }
        />
      ))}
    </div>
  )
}
