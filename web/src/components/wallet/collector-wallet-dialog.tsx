'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SeedPhraseDisplay } from './seed-phrase-display'
import { Wallet, AlertCircle, CheckCircle2 } from 'lucide-react'

interface CollectorWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (address: string) => void
}

export function CollectorWalletDialog({ open, onOpenChange, onConnect }: CollectorWalletDialogProps) {
  const [tab, setTab] = useState<'import' | 'generate'>('import')

  // Import tab
  const [mnemonic, setMnemonic] = useState('')
  const [importAddress, setImportAddress] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // Generate tab
  const [genStep, setGenStep] = useState<'idle' | 'generating' | 'confirm'>('idle')
  const [generatedWallet, setGeneratedWallet] = useState<{
    mnemonic: string
    address: string
    wif: string
  } | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  async function handleDeriveMnemonic() {
    setImportError(null)
    setImportAddress(null)
    setImporting(true)
    try {
      const { addressFromMnemonic } = await import('@/lib/bsv/wallet')
      const address = addressFromMnemonic(mnemonic.trim())
      setImportAddress(address)
    } catch {
      setImportError('Invalid seed phrase. Check your words and try again.')
    } finally {
      setImporting(false)
    }
  }

  async function handleGenerate() {
    setGenStep('generating')
    setGenError(null)
    try {
      const { generateWallet } = await import('@/lib/bsv/wallet')
      setGeneratedWallet(generateWallet())
      setGenStep('confirm')
    } catch {
      setGenError('Failed to generate wallet')
      setGenStep('idle')
    }
  }

  function handleConfirmImport() {
    if (!importAddress) return
    onConnect(importAddress)
    onOpenChange(false)
    resetState()
  }

  function handleConfirmGenerate() {
    if (!generatedWallet) return
    onConnect(generatedWallet.address)
    onOpenChange(false)
    resetState()
  }

  function resetState() {
    setMnemonic('')
    setImportAddress(null)
    setImportError(null)
    setGenStep('idle')
    setGeneratedWallet(null)
    setGenError(null)
    setTab('import')
  }

  const wordCount = mnemonic.trim().split(/\s+/).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState() }}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0f]/95 backdrop-blur border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Connect BSV Wallet
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'import' | 'generate')}>
          <TabsList className="w-full bg-white/5 border border-white/10">
            <TabsTrigger value="import" className="flex-1 data-[state=active]:bg-white/10">
              I have a wallet
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex-1 data-[state=active]:bg-white/10">
              Create new
            </TabsTrigger>
          </TabsList>

          {/* ── Import tab ─────────────────────────────────────────── */}
          <TabsContent value="import" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your 12-word seed phrase to derive your BSV address.
            </p>

            <textarea
              value={mnemonic}
              onChange={(e) => {
                setMnemonic(e.target.value)
                setImportAddress(null)
                setImportError(null)
              }}
              placeholder="word1 word2 word3 … word12"
              rows={3}
              className="w-full rounded-lg bg-white/5 border border-white/10 focus:border-white/25 px-3 py-2 text-sm outline-none resize-none placeholder:text-white/30 text-white font-mono"
            />

            {importError && (
              <p className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {importError}
              </p>
            )}

            {importAddress && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-300 mb-0.5">Address derived</p>
                  <p className="font-mono text-xs text-white/70 break-all">{importAddress}</p>
                </div>
              </div>
            )}

            {!importAddress ? (
              <Button
                onClick={handleDeriveMnemonic}
                disabled={wordCount < 12 || importing}
                className="w-full"
              >
                {importing ? 'Deriving address…' : `Derive Address${wordCount > 0 ? ` (${wordCount}/12)` : ''}`}
              </Button>
            ) : (
              <Button onClick={handleConfirmImport} className="w-full">
                Connect This Wallet
              </Button>
            )}
          </TabsContent>

          {/* ── Generate tab ───────────────────────────────────────── */}
          <TabsContent value="generate" className="mt-4 space-y-4">
            {genStep === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Generate a new BSV wallet to hold ordinals and receive MNEE rewards.
                </p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200/80">
                    Your seed phrase is shown once. Write it down — we never store your keys.
                  </p>
                </div>
                <Button onClick={handleGenerate} className="w-full">
                  Generate Wallet
                </Button>
              </div>
            )}

            {genStep === 'generating' && (
              <div className="py-6 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Generating wallet…</p>
              </div>
            )}

            {genStep === 'confirm' && generatedWallet && (
              <div className="space-y-4">
                <SeedPhraseDisplay
                  mnemonic={generatedWallet.mnemonic}
                  address={generatedWallet.address}
                />
                <Button onClick={handleConfirmGenerate} className="w-full">
                  I've saved my seed phrase — Connect
                </Button>
              </div>
            )}

            {genError && (
              <p className="text-xs text-red-400">{genError}</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
