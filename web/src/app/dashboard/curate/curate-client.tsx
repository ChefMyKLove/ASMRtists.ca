'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Check, X } from 'lucide-react'
import { approveArtworkAction, rejectArtworkAction } from '@/app/actions/collections'

interface ArtworkItem {
  id: string
  title: string
  thumbnailUrl: string
  artistName: string
  createdAt: string
}

interface Props {
  items: ArtworkItem[]
}

export function CurateClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function handleApprove(id: string) {
    setActing(id)
    startTransition(async () => {
      const result = await approveArtworkAction(id)
      setActing(null)
      if (result.error) {
        setErrors((e) => ({ ...e, [id]: result.error! }))
      } else {
        removeItem(id)
      }
    })
  }

  function handleReject(id: string) {
    setActing(id)
    startTransition(async () => {
      const result = await rejectArtworkAction(id)
      setActing(null)
      if (result.error) {
        setErrors((e) => ({ ...e, [id]: result.error! }))
      } else {
        removeItem(id)
      }
    })
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-muted-foreground text-sm">All caught up — no pending submissions.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const isActing = acting === item.id && isPending
        return (
          <div key={item.id} className="glass rounded-xl overflow-hidden">
            <div className="relative aspect-square bg-white/5">
              {item.thumbnailUrl ? (
                <Image
                  src={item.thumbnailUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                  No preview
                </div>
              )}
            </div>
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.artistName}</p>
              </div>
              {errors[item.id] && (
                <p className="text-xs text-red-400">{errors[item.id]}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleApprove(item.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleReject(item.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
