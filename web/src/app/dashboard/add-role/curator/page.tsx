'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Check, AlertTriangle, Wallet, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiStepForm } from '@/components/auth/multi-step-form'
import { createClient } from '@/lib/supabase/client'
import { generateWallet } from '@/lib/bsv/wallet'
import { addCuratorRole, saveWalletAddress } from '@/app/actions/register'
import type { WalletResult } from '@/lib/bsv/wallet'
import { cn } from '@/lib/utils'

const profileSchema = z.object({
  orgName: z.string().min(1, 'Name is required').max(80),
  bio: z.string().max(500).optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

type ProfileValues = z.infer<typeof profileSchema>

const TIERS = [
  { id: 'free', name: 'Explorer', price: 0, collections: 1, revenueShare: 0, galleries: 0 },
  { id: 'emerging', name: 'Emerging', price: 29, collections: 2, revenueShare: 5, galleries: 1 },
  { id: 'gallery', name: 'Gallery', price: 99, collections: 5, revenueShare: 8, galleries: 3, popular: true },
  { id: 'institution', name: 'Institution', price: 299, collections: -1, revenueShare: 10, galleries: -1 },
]

const STEPS = ['Profile', 'Choose Tier', 'BSV Wallet']

export default function AddCuratorRolePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [selectedTier, setSelectedTier] = useState('free')
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [pendingProfile, setPendingProfile] = useState<ProfileValues | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { orgName: '', bio: '', website: '' },
  })

  function onProfileSubmit(values: ProfileValues) {
    setPendingProfile(values)
    setStep(2)
  }

  async function handleTierContinue() {
    if (!userId || !pendingProfile) return
    setServerError(null)
    const isFree = selectedTier === 'free'
    const { error } = await addCuratorRole(
      userId,
      pendingProfile.orgName,
      pendingProfile.bio || null,
      pendingProfile.website || null,
      selectedTier,
      isFree,
    )
    if (error) {
      setServerError(error)
      return
    }

    if (isFree) {
      setStep(3)
      return
    }

    // Paid tier — redirect to Stripe Checkout
    const res = await fetch('/api/stripe/curator-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: selectedTier }),
    })
    const data = await res.json() as { url?: string; pending?: boolean; error?: string }
    if (data.error) { setServerError(data.error); return }
    if (data.pending) {
      setServerError('Payment processing is coming soon. Your application has been saved.')
      return
    }
    if (data.url) window.location.href = data.url
  }

  async function handleSaveWallet() {
    if (!wallet || !seedConfirmed || !userId) return
    setSavingWallet(true)
    setServerError(null)
    const { error } = await saveWalletAddress(userId, wallet.address)
    if (error) {
      setServerError('Could not save wallet. You can add it from your profile later.')
    }
    setSavingWallet(false)
    router.push('/dashboard')
    router.refresh()
  }

  function handleSkip() {
    router.push('/dashboard')
    router.refresh()
  }

  const isFreeTier = selectedTier === 'free'
  const activeTier = TIERS.find((t) => t.id === selectedTier)
  const words = wallet ? wallet.mnemonic.split(' ') : []

  return (
    <div className="w-full max-w-2xl mx-auto">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Become a Curator</CardTitle>
          <CardDescription>Build themed galleries and earn revenue share.</CardDescription>
          <div className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Profile */}
          {step === 1 && (
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Display Name / Organization</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. Northern Lights Gallery"
                  className="bg-white/5 border-white/10"
                  {...profileForm.register('orgName')}
                />
                {profileForm.formState.errors.orgName && (
                  <p className="text-xs text-red-400">{profileForm.formState.errors.orgName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <textarea
                  id="bio"
                  rows={3}
                  placeholder="Tell artists and collectors about your curatorial focus..."
                  className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                  {...profileForm.register('bio')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourgallery.com"
                  className="bg-white/5 border-white/10"
                  {...profileForm.register('website')}
                />
                {profileForm.formState.errors.website && (
                  <p className="text-xs text-red-400">{profileForm.formState.errors.website.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full">Continue</Button>
              <Button type="button" onClick={() => router.back()} variant="ghost" className="w-full text-muted-foreground">
                Cancel
              </Button>
            </form>
          )}

          {/* Step 2: Choose Tier */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTier(tier.id)}
                    className={cn(
                      'relative text-left rounded-xl p-4 border transition-all',
                      selectedTier === tier.id
                        ? 'border-purple-400/60 bg-purple-400/10'
                        : 'border-white/10 glass hover:border-white/20'
                    )}
                  >
                    {'popular' in tier && tier.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 text-white whitespace-nowrap">
                        Most Popular
                      </span>
                    )}
                    {selectedTier === tier.id && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-4 w-4 text-purple-400" />
                      </div>
                    )}
                    <p className="font-semibold text-sm">{tier.name}</p>
                    <p className="text-2xl font-bold mt-1">
                      {tier.price === 0 ? (
                        <span className="text-white">Free</span>
                      ) : (
                        <>
                          <span className="rainbow-text">${tier.price}</span>
                          <span className="text-xs text-muted-foreground font-normal">/yr</span>
                        </>
                      )}
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      <li className="text-xs text-muted-foreground">
                        {tier.collections === -1 ? '∞ collections' : `${tier.collections} collection${tier.collections !== 1 ? 's' : ''}`}
                      </li>
                      <li className="text-xs text-muted-foreground">
                        {tier.revenueShare > 0 ? `${tier.revenueShare}% revenue share` : 'No revenue share'}
                      </li>
                      <li className="text-xs text-muted-foreground">
                        {tier.galleries === 0 ? 'No gallery pages' : tier.galleries === -1 ? 'Unlimited gallery pages' : `${tier.galleries} gallery page${tier.galleries !== 1 ? 's' : ''}`}
                      </li>
                    </ul>
                  </button>
                ))}
              </div>

              {!isFreeTier && (
                <p className="text-xs text-muted-foreground text-center">
                  Payment collected after your account is approved.
                </p>
              )}

              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>
              )}

              <Button onClick={handleTierContinue} className="w-full" disabled={!userId}>
                {isFreeTier ? 'Continue for free' : `Continue with ${activeTier?.name} plan`}
              </Button>
            </div>
          )}

          {/* Step 3: BSV Wallet */}
          {step === 3 && (
            <div className="space-y-5">
              <div className={cn('glass rounded-xl p-4 space-y-2 border', isFreeTier ? 'border-white/10' : 'border-amber-400/20')}>
                <div className={cn('flex items-center gap-2', isFreeTier ? 'text-white' : 'text-amber-400')}>
                  {!isFreeTier && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
                  <h3 className="font-medium text-sm">
                    {isFreeTier ? 'Optional: BSV Wallet' : 'BSV Wallet Required'}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isFreeTier
                    ? 'Add a wallet now to be ready to earn when you upgrade to a paid tier.'
                    : <>Revenue share is paid directly to your BSV address. <strong className="text-white">We never see your seed phrase.</strong></>}
                </p>
              </div>

              {!wallet ? (
                <div className="space-y-3">
                  <Button onClick={() => { setWallet(generateWallet()); setSeedVisible(false); setSeedConfirmed(false) }} className="w-full" variant={isFreeTier ? 'outline' : 'default'}>
                    <Wallet className="h-4 w-4 mr-2" />
                    Generate my BSV wallet
                  </Button>
                  {isFreeTier && (
                    <Button onClick={handleSkip} variant="ghost" className="w-full text-muted-foreground">
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip for now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Your 12-word seed phrase</p>
                      <button type="button" onClick={() => setSeedVisible((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
                        {seedVisible ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show seed phrase</>}
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
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5" checked={seedConfirmed} onChange={(e) => setSeedConfirmed(e.target.checked)} />
                    <span className="text-xs text-muted-foreground">
                      I have saved my seed phrase.{' '}
                      <strong className="text-white">If I lose it, no one can recover my funds.</strong>
                    </span>
                  </label>
                  {serverError && (
                    <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>
                  )}
                  <div className="flex gap-3">
                    <Button onClick={handleSaveWallet} className="flex-1" disabled={!seedConfirmed || savingWallet}>
                      {savingWallet ? 'Saving...' : 'Save wallet & finish'}
                    </Button>
                    {isFreeTier && (
                      <Button onClick={handleSkip} variant="ghost" className="text-muted-foreground">Skip</Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
