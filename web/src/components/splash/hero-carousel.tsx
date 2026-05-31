'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CarouselSlide {
  id: string
  imageUrl: string
  artistName: string
  artworkTitle: string
  artistSlug: string
  audienceTag?: string
  subhead?: string
  body?: string
  glyphType?: 'bsv'
  duration?: number
}

interface HeroCarouselProps {
  slides: CarouselSlide[]
  autoPlayInterval?: number
}

function BsvGlyph() {
  return (
    <div className="flex flex-col items-center gap-1 select-none pointer-events-none">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 72, height: 72 }}
      >
        {/* Outer ring */}
        <svg
          viewBox="0 0 72 72"
          fill="none"
          className="absolute inset-0 w-full h-full"
        >
          <circle
            cx="36" cy="36" r="34"
            stroke="#0AB25A"
            strokeWidth="1.2"
            opacity="0.55"
          />
          {/* Inner accent ring */}
          <circle
            cx="36" cy="36" r="28"
            stroke="#0AB25A"
            strokeWidth="0.5"
            opacity="0.25"
          />
        </svg>
        {/* Bitcoin symbol */}
        <span
          className="relative z-10 font-display"
          style={{
            fontSize: 34,
            lineHeight: 1,
            color: '#0AB25A',
            opacity: 0.85,
            textShadow: '0 0 20px rgba(10,178,90,0.4)',
          }}
        >
          ₿
        </span>
      </div>
      {/* BSV label */}
      <span
        className="font-sans"
        style={{
          fontSize: 9,
          letterSpacing: '0.38em',
          color: '#0AB25A',
          opacity: 0.65,
          textTransform: 'uppercase',
        }}
      >
        BSV
      </span>
    </div>
  )
}

export function HeroCarousel({ slides, autoPlayInterval = 6000 }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  useEffect(() => {
    if (slides.length <= 1) return
    const slideDuration = slides[current]?.duration ?? autoPlayInterval
    const timer = setTimeout(next, slideDuration)
    return () => clearTimeout(timer)
  }, [current, next, slides, autoPlayInterval])

  if (slides.length === 0) {
    return (
      <div className="relative h-[60vh] min-h-[440px] w-full glass flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No featured artworks yet</p>
      </div>
    )
  }

  return (
    <div className="relative h-[60vh] min-h-[440px] w-full overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000',
            index === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <Image
            src={slide.imageUrl}
            alt={slide.artworkTitle}
            fill
            className={cn(
              'object-cover carousel-img',
              index === current && 'carousel-img-active'
            )}
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 420px"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

          {/* BSV glyph — top-left, decorative */}
          {slide.glyphType === 'bsv' && (
            <div className="absolute top-5 left-5">
              <BsvGlyph />
            </div>
          )}

          {/* Audience copy — bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pt-10 pb-6">
            {slide.audienceTag && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70 mb-3">
                {slide.audienceTag}
              </p>
            )}
            {slide.subhead && (
              <h3 className="font-display text-2xl sm:text-[28px] text-white leading-tight mb-2">
                {slide.subhead}
              </h3>
            )}
            {slide.body && (
              <p className="text-[13px] text-white/65 leading-relaxed line-clamp-3">
                {slide.body}
              </p>
            )}
            {!slide.subhead && (
              <>
                <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">
                  {slide.artistName}
                </p>
                <p className="text-white font-semibold text-xl leading-tight">
                  {slide.artworkTitle}
                </p>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Dot indicators — top right */}
      {slides.length > 1 && (
        <div className="absolute top-5 right-5 flex gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                index === current ? 'w-6 bg-white' : 'w-1.5 bg-white/35'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
