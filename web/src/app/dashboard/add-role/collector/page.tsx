'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Wallet, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { generateWallet } from '@/lib/bsv/wallet'
import { addCollectorRole, saveWalletAddress } from '@/app/actions/register'
import type { WalletResult } from '@/lib/bsv/wallet'

export default function AddCollectorRolePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  async function handleActivate() {
    if (!userId) return
    setAdding(true)
    setServerError(null)
    const { error } = await addCollectorRole(userId)
    if (error) {
      setServerError(error)
      setAdding(false)
      return
    }
    setDone(true)
    setAdding(false)
  }

  async function handleSaveWallet() {
    if (!wallet || !seedConfirmed || !userId) return
    setSavingWallet(true)
    setServerError(null)
    const { error } = await saveWalletAddress(userId, wallet.address, wallet.ordAddress)
    if (error) {
      setServerError('Could not save wallet address. You can add it from your profile later.')
    }
    setSavingWallet(false)
    router.push('/dashboard')
    router.refresh()
  }

  function handleSkip() {
    router.push('/dashboard')
    router.refresh()
  }

  const words = wallet ? wallet.mnemonic.split(' ') : []

  if (done) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <Card className="glass">
          <CardContent className="pt-8 pb-8 text-center space-y-5">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto">
              <span className="text-2xl">🖼️</span>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Collector role added!</h3>
              <p className="text-sm text-muted-foreground">
                You can now browse, collect, and earn MNEE rewards. Add a BSV wallet to receive them.
              </p>
            </div>

            {!wallet ? (
              <div className="space-y-3">
                <Button
                  onClick={() => { setWallet(generateWallet()); setSeedVisible(false); setSeedConfirmed(false) }}
                  className="w-full"
                  variant="outline"
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  Set up a BSV wallet
                </Button>
                <Button onClick={handleSkip} variant="ghost" className="w-full text-muted-foreground">
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip for now
                </Button>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Your 12-word seed phrase</p>
                    <button
                      type="button"
                      onClick={() => setSeedVisible((v) => !v)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                    >
                      {seedVisible ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
                    </button>
                  </div>
                  <div className="relative grid grid-cols-3 gap-2">
                    {words.map((word, i) => (
                      <div key={i} className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-2">
                        <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">{i + 1}</span>
                        <span className={`font-mono text-xs ${seedVisible ? 'text-white' : 'blur-sm text-white select-none'}`}>{word}</span>
                      </div>
                    ))}
                    {!seedVisible && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button type="button" onClick={() => setSeedVisible(true)} className="text-xs text-white/80 hover:text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors">
                          Click to reveal
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground bg-white/5 rounded-lg px-3 py-2 break-all">
                    Address: {wallet.address}
                  </p>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5"
                    checked={seedConfirmed}
                    onChange={(e) => setSeedConfirmed(e.target.checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    I&apos;ve saved my seed phrase.{' '}
                    <strong className="text-white">If I lose it, no one can recover my funds.</strong>
                  </span>
                </label>
                {serverError && (
                  <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>
                )}
                <div className="flex gap-3">
                  <Button onClick={handleSaveWallet} className="flex-1" disabled={!seedConfirmed || savingWallet}>
                    {savingWallet ? 'Saving...' : 'Save wallet & continue'}
                  </Button>
                  <Button onClick={handleSkip} variant="ghost" className="text-muted-foreground">Skip</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Become a Collector</CardTitle>
          <CardDescription>
            Browse art, hold BSV originals, and earn MNEE rewards on every purchase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="glass rounded-xl p-4 space-y-3">
            {['Browse and purchase limited-edition prints', 'Hold 1Sat Ordinals — verifiable BSV originals', 'Earn MNEE stablecoin rewards on every order', 'Build your collection and follow your favourite artists'].map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <span className="text-purple-400 mt-0.5">✓</span>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>

          {serverError && (
            <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>
          )}

          <Button onClick={handleActivate} className="w-full" disabled={adding || !userId}>
            {adding ? 'Activating...' : 'Activate Collector role'}
          </Button>
          <Button onClick={() => router.back()} variant="ghost" className="w-full text-muted-foreground">
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
