'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { FeaturedCollection } from '@/app/(public)/page'

export function FeaturedHeroCarousel({ collections }: { collections: FeaturedCollection[] }) {
  const [index, setIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (collections.length <= 1) return
    const id = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setIndex((i) => (i + 1) % collections.length)
        setFading(false)
      }, 500)
    }, 3500) // 3s visible + 0.5s fade out
    return () => clearInterval(id)
  }, [collections.length])

  if (!collections.length) {
    return (
      <div className="relative lg:flex-1 h-72 lg:h-auto overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#c4b0ff]/15 via-[#ffb3d1]/10 to-[#b3f0c8]/10" />
        <div className="absolute inset-0 flex items-end p-8">
          <p className="text-sm text-white/30">No featured collections</p>
        </div>
      </div>
    )
  }

  const featured = collections[index]

  return (
    <Link
      href={`/c/${featured.artist?.username ?? ''}/${featured.slug}`}
      className="relative lg:flex-1 h-72 lg:h-auto group block overflow-hidden"
    >
      {/* Full-bleed image — fades with the slide */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {featured.cover_image_url ? (
          <Image
            src={featured.cover_image_url}
            alt={featured.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 48vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#c4b0ff]/20 via-[#ffb3d1]/10 to-[#b3f0c8]/15" />
        )}
      </div>

      {/* Gradient overlay — always visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Caption — fades with the slide */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 lg:p-8 transition-opacity duration-500"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-1">
          Featured · {featured.artist?.stage_name ?? 'Artist'}
        </p>
        <h2 className="text-2xl lg:text-3xl font-bold text-white leading-tight mb-1 group-hover:text-[#c4b0ff] transition-colors">
          {featured.title}
        </h2>
        {featured.description && (
          <p className="text-sm text-white/60 leading-relaxed line-clamp-2 mb-3 max-w-md">
            {featured.description}
          </p>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
          {featured.piece_count} {featured.piece_count === 1 ? 'piece' : 'pieces'}
          <span className="text-white/30">·</span>
          <span className="text-white/70 group-hover:text-white transition-colors">
            View collection →
          </span>
        </span>
      </div>

      {/* Dot indicators — only when multiple collections */}
      {collections.length > 1 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
          {collections.map((_, i) => (
            <span
              key={i}
              className="block h-1 rounded-full transition-all duration-300 bg-white"
              style={{ width: i === index ? '1rem' : '0.25rem', opacity: i === index ? 1 : 0.3 }}
            />
          ))}
        </div>
      )}
    </Link>
  )
}
