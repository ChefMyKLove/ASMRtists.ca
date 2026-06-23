'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Upload, Wallet, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiStepForm } from '@/components/auth/multi-step-form'
import { WalletConnector } from '@/components/wallet/wallet-connector'
import { createClient } from '@/lib/supabase/client'
import { generateWallet } from '@/lib/bsv/wallet'
import { createArtistProfile, saveWalletAddress } from '@/app/actions/register'
import type { WalletResult } from '@/lib/bsv/wallet'
import type { WalletConnection } from '@/lib/wallet/connectors'

const profileSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(64),
  bio: z.string().max(280, 'Bio must be 280 characters or less').optional(),
  location: z.string().max(64).optional(),
})

type ProfileValues = z.infer<typeof profileSchema>

const STEPS = ['Profile', 'BSV Wallet', 'Done']

export default function AddArtistRolePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [walletMode, setWalletMode] = useState<'choose' | 'existing' | 'generate'>('choose')
  const [existingWallet, setExistingWallet] = useState<WalletConnection | null>(null)
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { stageName: '', bio: '', location: '' },
  })

  async function onProfileSubmit(values: ProfileValues) {
    if (!userId) return
    setServerError(null)
    const { error } = await createArtistProfile(userId, values.stageName, values.bio || null, values.location || null)
    if (error) {
      setServerError(error)
      return
    }
    setStep(2)
  }

  async function handleSaveExistingWallet() {
    if (!existingWallet || !userId) return
    setSavingWallet(true)
    setServerError(null)
    const { error } = await saveWalletAddress(userId, existingWallet.bsvAddress, existingWallet.ordAddress, true)
    if (error) {
      setServerError('Could not save wallet address. Please try again.')
    } else {
      setStep(3)
    }
    setSavingWallet(false)
  }

  async function handleSaveWallet() {
    if (!wallet || !seedConfirmed || !userId) return
    setSavingWallet(true)
    setServerError(null)
    const { error } = await saveWalletAddress(userId, wallet.address, wallet.ordAddress)
    if (error) {
      setServerError('Could not save wallet address. Please try again.')
    } else {
      setStep(3)
    }
    setSavingWallet(false)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const bioValue = profileForm.watch('bio') ?? ''
  const words = wallet ? wallet.mnemonic.split(' ') : []

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Apply as an Artist</CardTitle>
          <CardDescription>Upload work, sell prints, mint ordinals, and earn MNEE + Stripe payouts.</CardDescription>
          <div className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Profile */}
          {step === 1 && (
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-full glass flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Profile photo</p>
                  <p className="text-xs text-muted-foreground">Optional — JPG, PNG, WebP</p>
                  <button type="button" onClick={() => avatarInputRef.current?.click()} className="text-xs text-white/70 hover:text-white mt-1 transition-colors">
                    Choose file
                  </button>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stageName">Stage Name</Label>
                <Input id="stageName" placeholder="The name your art is known by" className="bg-white/5 border-white/10" {...profileForm.register('stageName')} />
                {profileForm.formState.errors.stageName && (
                  <p className="text-xs text-red-400">{profileForm.formState.errors.stageName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Bio</Label>
                  <span className="text-xs text-muted-foreground">{bioValue.length}/280</span>
                </div>
                <textarea
                  id="bio"
                  rows={3}
                  placeholder="Tell the world about your art..."
                  className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                  {...profileForm.register('bio')}
                />
                {profileForm.formState.errors.bio && (
                  <p className="text-xs text-red-400">{profileForm.formState.errors.bio.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input id="location" placeholder="City, Country" className="bg-white/5 border-white/10" {...profileForm.register('location')} />
              </div>

              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>
              )}

              <Button type="submit" className="w-full" disabled={profileForm.formState.isSubmitting || !userId}>
                {profileForm.formState.isSubmitting ? 'Saving...' : 'Continue'}
              </Button>
              <Button type="button" onClick={() => router.back()} variant="ghost" className="w-full text-muted-foreground">
                Cancel
              </Button>
            </form>
          )}

          {/* Step 2: BSV Wallet */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="glass rounded-xl p-4 space-y-2 border border-amber-400/20">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <h3 className="font-medium text-sm">BSV Wallet Required</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your earnings are paid to your BSV address. Use your existing wallet or generate a new one.
                </p>
              </div>

              {walletMode === 'choose' && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setWalletMode('existing')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors text-left">
                    <Wallet className="h-5 w-5 text-violet-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Use my existing wallet</p>
                      <p className="text-xs text-muted-foreground">Connect Yours Wallet, HandCash, or RelayX</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setWalletMode('generate')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/5 transition-colors text-left">
                    <span className="text-lg flex-shrink-0">✨</span>
                    <div>
                      <p className="text-sm font-medium">Generate a new wallet</p>
                      <p className="text-xs text-muted-foreground">We&apos;ll create a fresh BSV wallet for you</p>
                    </div>
                  </button>
                </div>
              )}

              {walletMode === 'existing' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => { setWalletMode('choose'); setExistingWallet(null) }} className="text-xs text-muted-foreground hover:text-white transition-colors">
                    ← Back
                  </button>
                  {!existingWallet ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">Connect your BSV wallet to link it to your profile.</p>
                      <WalletConnector onConnected={(conn) => setExistingWallet(conn)} />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="glass rounded-xl p-4 space-y-1.5">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Connected</p>
                        <p className="text-xs font-mono break-all">{existingWallet.ordAddress}</p>
                        {existingWallet.bsvAddress !== existingWallet.ordAddress && (
                          <p className="text-xs font-mono text-muted-foreground break-all">Payment: {existingWallet.bsvAddress}</p>
                        )}
                      </div>
                      {serverError && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>}
                      <Button onClick={handleSaveExistingWallet} className="w-full" disabled={savingWallet}>
                        {savingWallet ? 'Saving...' : 'Use this wallet & submit application'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {walletMode === 'generate' && (
                <div className="space-y-4">
                  <button type="button" onClick={() => { setWalletMode('choose'); setWallet(null); setSeedConfirmed(false) }} className="text-xs text-muted-foreground hover:text-white transition-colors">
                    ← Back
                  </button>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-white">We never see your seed phrase or private key.</strong> If you lose it, no one can recover your funds.
                  </p>
                  {!wallet ? (
                    <Button onClick={() => { setWallet(generateWallet()); setSeedVisible(false); setSeedConfirmed(false) }} className="w-full">
                      Generate my BSV wallet
                    </Button>
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
                        <div className="space-y-1">
                          <p className="text-xs font-mono text-muted-foreground bg-white/5 rounded-lg px-3 py-2 break-all">Payment: {wallet.address}</p>
                          <p className="text-xs font-mono text-muted-foreground bg-white/5 rounded-lg px-3 py-2 break-all">Ordinals: {wallet.ordAddress}</p>
                        </div>
                      </div>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5" checked={seedConfirmed} onChange={(e) => setSeedConfirmed(e.target.checked)} />
                        <span className="text-xs text-muted-foreground">
                          I have saved my seed phrase. <strong className="text-white">If I lose it, no one can recover my funds.</strong>
                        </span>
                      </label>
                      {serverError && <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{serverError}</p>}
                      <Button onClick={handleSaveWallet} className="w-full" disabled={!seedConfirmed || savingWallet}>
                        {savingWallet ? 'Saving...' : 'Save wallet & submit application'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Application submitted */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto">
                <span className="text-2xl">🎨</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Application submitted!</h3>
                <p className="text-sm text-muted-foreground">
                  Your artist application is under review. We&apos;ll notify you by email once approved — usually within 1–2 business days.
                </p>
              </div>
              <Button onClick={() => { router.push('/dashboard'); router.refresh() }} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
