'use client'

import { useEffect, useRef } from 'react'

interface SaleEvent {
  id: string
  artistName: string
  artworkTitle: string
  amount: string
  timeAgo: string
}

interface SaleTickerProps {
  sales: SaleEvent[]
}

export function SaleTicker({ sales }: SaleTickerProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track || sales.length === 0) return

    // CSS animation handles the scroll — this just resets on re-mount
    track.style.animationPlayState = 'running'
  }, [sales.length])

  if (sales.length === 0) return null

  // Duplicate items for seamless loop
  const items = [...sales, ...sales]

  return (
    <div className="overflow-hidden border-y border-white/10 bg-black/20 py-2">
      <div
        ref={trackRef}
        className="flex gap-8 animate-ticker whitespace-nowrap"
        style={{ animationDuration: `${items.length * 4}s` }}
      >
        {items.map((sale, index) => (
          <span key={`${sale.id}-${index}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
            <span className="text-emerald-400 text-xs">SOLD</span>
            <span className="text-white/80">{sale.artworkTitle}</span>
            <span>by</span>
            <span className="text-white/80">{sale.artistName}</span>
            <span className="text-white/40 text-xs">{sale.amount}</span>
            <span className="text-white/30 text-xs">{sale.timeAgo}</span>
            <span className="text-white/20 mx-2">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
