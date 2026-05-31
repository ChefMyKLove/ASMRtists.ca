'use client'

import { useEffect, useRef, useState } from 'react'

const AUDIENCE = [
  {
    role: 'For Collectors',
    hook: 'Are you ready for the ultimate gamified art-owning experience?',
  },
  {
    role: 'For Artists',
    hook: 'Are you ready to have your patrons become your marketing team?',
  },
  {
    role: 'For Curators',
    hook: 'Are you ready to be the first to spot the next big wave?',
  },
  {
    role: 'Get Started',
    hook: '',
  },
]

export function AudienceCarousel() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function advance(next: number) {
    setAnimating(true)
    setTimeout(() => {
      setCurrent(next)
      setAnimating(false)
    }, 300)
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        const next = (c + 1) % AUDIENCE.length
        setAnimating(true)
        setTimeout(() => {
          setCurrent(next)
          setAnimating(false)
        }, 300)
        return c
      })
    }, 4500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const item = AUDIENCE[current]

  return (
    <div className="rounded-2xl overflow-hidden bg-white text-black">
      {/* Role tabs */}
      <div className="flex border-b border-black/10">
        {AUDIENCE.map((a, i) => (
          <button
            key={a.role}
            type="button"
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current)
              advance(i)
            }}
            className={`flex-1 px-3 py-4 text-[11px] uppercase tracking-[0.22em] font-medium transition-colors duration-200 ${
              i === current
                ? 'bg-black/10 text-black'
                : 'text-black/35 hover:text-black/60'
            }`}
          >
            {a.role}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className={`px-8 py-10 transition-opacity duration-300 min-h-[120px] flex items-center ${animating ? 'opacity-0' : 'opacity-100'}`}
      >
        {item.hook ? (
          <p className="font-bold text-2xl md:text-3xl leading-snug">
            {item.hook}
          </p>
        ) : (
          <a
            href="https://asmrtists.ca"
            className="font-bold text-3xl md:text-5xl leading-tight underline underline-offset-8 decoration-black/30 hover:decoration-black transition-all"
          >
            ASMRtists.ca
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-px bg-black/10 relative overflow-hidden">
        <div
          key={current}
          className="absolute inset-y-0 left-0 bg-black/30 audience-progress-bar"
        />
      </div>
    </div>
  )
}
