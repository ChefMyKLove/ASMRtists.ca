'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const words = ['Art', 'Splash', 'Marketing', 'Roster'] as const

const chars = words.flatMap((word, wi) => [
  ...word.split('').map((char, ci) => ({ char, isFirst: ci === 0 })),
  ...(wi < words.length - 1 ? [{ char: ' ', isFirst: false }] : []),
])

export function AnimatedRoster() {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.dataset.playing = 'true'
      })
    })
  }, [])

  return (
    <p ref={ref} className="text-2xl uppercase tracking-[0.45em] mb-4">
      {chars.map(({ char, isFirst }, i) => (
        <span
          key={i}
          className={cn('letter-slide-in rainbow-text', isFirst && 'text-4xl font-bold')}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {char}
        </span>
      ))}
    </p>
  )
}
