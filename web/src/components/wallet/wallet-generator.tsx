'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeedPhraseDisplay } from './seed-phrase-display'
import { Wallet, AlertCircle } from 'lucide-react'

interface WalletGeneratorProps {
  onAddressConfirmed?: (address: string) => void
}

export function WalletGenerator({ onAddressConfirmed }: WalletGeneratorProps) {
  const [step, setStep] = useState<'idle' | 'generating' | 'confirm'>('idle')
  const [wallet, setWallet] = useState<{
    mnemonic: string
    address: string
    wif: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setStep('generating')
    setError(null)

    try {
      const { generateWallet } = await import('@/lib/bsv/wallet')
      const result = generateWallet()
      setWallet(result)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallet')
      setStep('idle')
    }
  }

  function handleConfirm() {
    if (wallet) {
      onAddressConfirmed?.(wallet.address)
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          BSV Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate a BSV wallet to receive MNEE payments and hold your ordinals.
            </p>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80">
                Your seed phrase will only be shown once. Write it down and keep it safe.
                We never store your keys.
              </p>
            </div>
            <Button onClick={handleGenerate} className="w-full">
              Generate New Wallet
            </Button>
          </div>
        )}

        {step === 'generating' && (
          <div className="py-4 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Generating wallet...</p>
          </div>
        )}

        {step === 'confirm' && wallet && (
          <div className="space-y-4">
            <SeedPhraseDisplay mnemonic={wallet.mnemonic} address={wallet.address} />
            <Button onClick={handleConfirm} className="w-full">
              I have saved my seed phrase
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
