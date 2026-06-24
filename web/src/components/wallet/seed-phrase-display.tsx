'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import { truncateAddress } from '@/lib/utils'

interface SeedPhraseDisplayProps {
  mnemonic: string
  address: string
  ordAddress?: string
}

export function SeedPhraseDisplay({ mnemonic, address, ordAddress }: SeedPhraseDisplayProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const words = mnemonic.split(' ')

  async function copyToClipboard() {
    await navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Seed Phrase
          </p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyToClipboard}
              aria-label="Copy seed phrase"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Hide seed phrase' : 'Reveal seed phrase'}
            >
              {revealed ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

        {revealed ? (
          <div className="grid grid-cols-3 gap-1.5">
            {words.map((word, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5 text-xs bg-white/5 rounded px-2 py-1"
              >
                <span className="text-white/30 w-4 text-right shrink-0">
                  {index + 1}.
                </span>
                <span className="font-mono text-white/90">{word}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 text-muted-foreground text-xs">
            Click the eye icon to reveal your seed phrase
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10">
        <p className="text-xs text-muted-foreground mb-1">BSV Pay Address</p>
        <p className="font-mono text-xs text-white/80 break-all">{address}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Short: {truncateAddress(address)}
        </p>
      </div>
      {ordAddress && ordAddress !== address && (
        <div className="p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-muted-foreground mb-1">BSV Ordinals Address</p>
          <p className="font-mono text-xs text-white/80 break-all">{ordAddress}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Short: {truncateAddress(ordAddress)}
          </p>
        </div>
      )}
    </div>
  )
}
