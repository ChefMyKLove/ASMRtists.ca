'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Upload, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiStepForm } from '@/components/auth/multi-step-form'
import { createClient } from '@/lib/supabase/client'
import { createArtistProfile, saveWalletAddress } from '@/app/actions/register'
import { generateWallet } from '@/lib/bsv/wallet'
import type { WalletResult } from '@/lib/bsv/wallet'

const accountSchema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username must be 32 characters or less')
      .regex(/^[a-z0-9_-]+$/, 'Lowercase letters, numbers, - and _ only'),
    displayName: z.string().min(1, 'Display name is required').max(64),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

const artistProfileSchema = z.object({
  stageName: z.string().min(1, 'Stage name is required').max(64),
  bio: z.string().max(280, 'Bio must be 280 characters or less').optional(),
  location: z.string().max(64).optional(),
})

type AccountValues = z.infer<typeof accountSchema>
type ArtistProfileValues = z.infer<typeof artistProfileSchema>

const STEPS = ['Account', 'Artist Profile', 'BSV Wallet', 'Done']

export default function RegisterArtistPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [registeredUserId, setRegisteredUserId] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: '', displayName: '', email: '', password: '', confirmPassword: '' },
  })

  const profileForm = useForm<ArtistProfileValues>({
    resolver: zodResolver(artistProfileSchema),
    defaultValues: { stageName: '', bio: '', location: '' },
  })

  function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const emailVal = e.target.value
    const username = accountForm.watch('username')
    if (!username && emailVal.includes('@')) {
      const suggested = emailVal
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 32)
      accountForm.setValue('username', suggested)
    }
  }

  async function onAccountSubmit(values: AccountValues) {
    setServerError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          username: values.username,
          display_name: values.displayName,
          role: 'artist',
        },
      },
    })

    if (error) {
      setServerError(error.message)
      return
    }

    if (!data.user) {
      setServerError('Account created — check your email to confirm before continuing.')
      return
    }

    setRegisteredUserId(data.user.id)
    setStep(2)
  }

  async function onProfileSubmit(values: ArtistProfileValues) {
    setServerError(null)

    if (!registeredUserId) {
      setServerError('Session lost — please start over.')
      return
    }

    const { error } = await createArtistProfile(
      registeredUserId,
      values.stageName,
      values.bio || null,
      values.location || null,
    )

    if (error) {
      setServerError(error)
      return
    }

    setStep(3)
  }

  function handleGenerateWallet() {
    const result = generateWallet()
    setWallet(result)
    setSeedVisible(false)
    setSeedConfirmed(false)
  }

  async function handleSaveWallet() {
    if (!wallet || !seedConfirmed || !registeredUserId) return
    setSavingWallet(true)
    setServerError(null)

    const { error } = await saveWalletAddress(registeredUserId, wallet.address)
    if (error) {
      setServerError('Could not save wallet address. Please try again.')
    } else {
      setStep(4)
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

  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(() => router.push('/dashboard'), 2000)
      return () => clearTimeout(t)
    }
  }, [step, router])

  const bioValue = profileForm.watch('bio') ?? ''
  const words = wallet ? wallet.mnemonic.split(' ') : []

  return (
    <div className="w-full max-w-lg">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Create Artist Account</CardTitle>
          <CardDescription>Upload your work, earn via MNEE and Stripe Connect.</CardDescription>
          <div className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Account */}
          {step === 1 && (
            <form
              onSubmit={accountForm.handleSubmit(onAccountSubmit)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="bg-white/5 border-white/10"
                  {...accountForm.register('email', { onBlur: handleEmailBlur })}
                />
                {accountForm.formState.errors.email && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your Name"
                  autoComplete="name"
                  className="bg-white/5 border-white/10"
                  {...accountForm.register('displayName')}
                />
                {accountForm.formState.errors.displayName && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.displayName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="your-username"
                  autoComplete="username"
                  className="bg-white/5 border-white/10"
                  {...accountForm.register('username')}
                />
                {accountForm.formState.errors.username && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="bg-white/5 border-white/10"
                  {...accountForm.register('password')}
                />
                {accountForm.formState.errors.password && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="bg-white/5 border-white/10"
                  {...accountForm.register('confirmPassword')}
                />
                {accountForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={accountForm.formState.isSubmitting}
              >
                {accountForm.formState.isSubmitting ? 'Creating account...' : 'Continue'}
              </Button>
            </form>
          )}

          {/* Step 2: Artist Profile */}
          {step === 2 && (
            <form
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-4"
            >
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div
                  className="h-16 w-16 rounded-full glass flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Profile photo</p>
                  <p className="text-xs text-muted-foreground">Optional — JPG, PNG, WebP</p>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs text-white/70 hover:text-white mt-1 transition-colors"
                  >
                    Choose file
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stageName">Stage Name</Label>
                <Input
                  id="stageName"
                  placeholder="The name your art is known by"
                  className="bg-white/5 border-white/10"
                  {...profileForm.register('stageName')}
                />
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
                <Input
                  id="location"
                  placeholder="City, Country"
                  className="bg-white/5 border-white/10"
                  {...profileForm.register('location')}
                />
              </div>

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          )}

          {/* Step 3: BSV Wallet (required) */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="glass rounded-xl p-4 space-y-2 border border-amber-400/20">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <h3 className="font-medium text-sm">BSV Wallet Required</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your earnings and ordinal royalties are paid directly to your BSV address.
                  Generate your wallet below — <strong className="text-white">we will never see
                  your seed phrase or private key</strong>, and if you lose them, no one can
                  recover your funds.
                </p>
              </div>

              {!wallet ? (
                <Button onClick={handleGenerateWallet} className="w-full">
                  Generate my BSV wallet
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Your 12-word seed phrase
                      </p>
                      <button
                        type="button"
                        onClick={() => setSeedVisible((v) => !v)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                      >
                        {seedVisible ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Show seed phrase
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative grid grid-cols-3 gap-2">
                      {words.map((word, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-2"
                        >
                          <span className="text-[10px] text-muted-foreground w-4 text-right flex-shrink-0">
                            {i + 1}
                          </span>
                          <span
                            className={`font-mono text-xs ${seedVisible ? 'text-white' : 'blur-sm text-white select-none'}`}
                          >
                            {word}
                          </span>
                        </div>
                      ))}
                      {!seedVisible && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setSeedVisible(true)}
                            className="text-xs text-white/80 hover:text-white bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg transition-colors"
                          >
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
                      I have saved my seed phrase in a safe place. I understand that{' '}
                      <strong className="text-white">if I lose it, no one can recover my funds</strong>.
                    </span>
                  </label>

                  {serverError && (
                    <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                      {serverError}
                    </p>
                  )}

                  <Button
                    onClick={handleSaveWallet}
                    className="w-full"
                    disabled={!seedConfirmed || savingWallet}
                  >
                    {savingWallet ? 'Saving...' : 'Save wallet & submit application'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Pending approval */}
          {step === 4 && (
            <div className="text-center space-y-5 py-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto">
                <span className="text-2xl">🎨</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Application submitted!</h3>
                <p className="text-sm text-muted-foreground">
                  Your artist application is under review. We&apos;ll notify you by email once
                  approved — usually within 1–2 business days.
                </p>
              </div>
              <div className="glass rounded-xl p-4 text-left space-y-1.5">
                <p className="text-xs font-medium">While you wait, you can:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Browse the gallery as a collector</li>
                  <li>• Complete your profile</li>
                  <li>• Prepare your first collection</li>
                </ul>
              </div>
              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
