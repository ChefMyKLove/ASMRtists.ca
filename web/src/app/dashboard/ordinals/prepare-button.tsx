'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Wand2, CheckCircle, AlertCircle } from 'lucide-react'
import { prepareOrdinalAction } from '@/app/actions/ordinals'

export function PrepareButton({ artworkId }: { artworkId: string }) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function handlePrepare() {
    startTransition(async () => {
      const result = await prepareOrdinalAction(artworkId)
      if (result.ok) {
        setState('done')
      } else {
        setState('error')
        setErrorMsg(result.error ?? 'Unknown error')
      }
    })
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
        JPEG prepared — refresh to continue
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        {errorMsg}
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs"
      onClick={handlePrepare}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
      ) : (
        <Wand2 className="h-3.5 w-3.5 mr-1.5" />
      )}
      {isPending ? 'Preparing…' : 'Prepare for Minting'}
    </Button>
  )
}
