'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Gem } from 'lucide-react'
import type { CollectionArtwork } from './types'

interface ArtworkCardProps {
  artwork: CollectionArtwork
  onClick: () => void
  isOwned?: boolean
}

export function ArtworkCard({ artwork, onClick, isOwned }: ArtworkCardProps) {
  const positionLabel = `#${String(artwork.position).padStart(2, '0')}`

  return (
    <button type="button" onClick={onClick} className="group text-left block w-full">
      <Card className="glass overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
        <div className="relative aspect-square bg-white/5">
          {artwork.thumbnail_url ? (
            <Image
              src={artwork.thumbnail_url}
              alt={artwork.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            />
          ) : (
            <div className="absolute inset-0 aurora-bg flex items-center justify-center">
              <span className="text-white/20 text-xl font-display">{positionLabel}</span>
            </div>
          )}

          <Badge className="absolute top-2 left-2 bg-black/60 text-white/60 text-[10px] font-mono border-0 backdrop-blur-sm">
            {positionLabel}
          </Badge>

          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {artwork.inscription_outpoint && (
              <Badge className="bg-amber-500/80 text-white text-[10px] border-0">
                <Gem className="h-2.5 w-2.5 mr-1" />
                Ordinal
              </Badge>
            )}
            {isOwned && (
              <Badge className="bg-emerald-500/90 text-white text-[10px] border-0 whitespace-nowrap">
                Owned by you
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-3">
          <p className="text-sm font-medium truncate group-hover:text-white transition-colors leading-snug">
            {artwork.title}
          </p>
        </CardContent>
      </Card>
    </button>
  )
}
