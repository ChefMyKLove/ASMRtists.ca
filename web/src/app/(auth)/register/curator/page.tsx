'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiStepForm } from '@/components/auth/multi-step-form'
import { createClient } from '@/lib/supabase/client'
import { generateWallet } from '@/lib/bsv/wallet'
import type { WalletResult } from '@/lib/bsv/wallet'
import { cn } from '@/lib/utils'

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

const curatorProfileSchema = z.object({
  orgName: z.string().min(1, 'Name is required').max(80),
  bio: z.string().max(500).optional(),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

type AccountValues = z.infer<typeof accountSchema>
type CuratorProfileValues = z.infer<typeof curatorProfileSchema>

const TIERS = [
  {
    id: 'emerging',
    name: 'Emerging',
    price: 29,
    artists: 5,
    collections: 2,
    revenueShare: 5,
    popular: false,
  },
  {
    id: 'gallery',
    name: 'Gallery',
    price: 99,
    artists: 20,
    collections: 5,
    revenueShare: 8,
    popular: true,
  },
  {
    id: 'institution',
    name: 'Institution',
    price: 299,
    artists: 100,
    collections: 20,
    revenueShare: 10,
    popular: false,
  },
]

const STEPS = ['Account', 'Profile', 'Choose Tier', 'BSV Wallet']

export default function RegisterCuratorPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedTier, setSelectedTier] = useState<string>('gallery')
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const accountForm = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: { username: '', displayName: '', email: '', password: '', confirmPassword: '' },
  })

  const profileForm = useForm<CuratorProfileValues>({
    resolver: zodResolver(curatorProfileSchema),
    defaultValues: { orgName: '', bio: '', website: '' },
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
      accountForm.setValue('username', suggested, { shouldValidate: true })
    }
  }

  function handleUsernameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    accountForm.setValue('username', sanitized, { shouldValidate: true })
  }

  async function onAccountSubmit(values: AccountValues) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          username: values.username,
          display_name: values.displayName,
          role: 'curator',
          curator_tier: selectedTier,
        },
      },
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setStep(2)
  }

  function onProfileSubmit() {
    setStep(3)
  }

  function handleGenerateWallet() {
    const result = generateWallet()
    setWallet(result)
    setSeedVisible(false)
    setSeedConfirmed(false)
  }

  async function handleSaveWallet() {
    if (!wallet || !seedConfirmed) return
    setSavingWallet(true)
    setServerError(null)
    try {
      const res = await fetch('/api/wallet/save-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet.address }),
      })
      if (!res.ok) throw new Error('Failed to save wallet')
      router.push('/dashboard')
      router.refresh()
    } catch {
      setServerError('Could not save wallet address. Please try again.')
    } finally {
      setSavingWallet(false)
    }
  }

  const words = wallet ? wallet.mnemonic.split(' ') : []

  return (
    <div className="w-full max-w-2xl">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Create Curator Account</CardTitle>
          <CardDescription>
            Sponsor artists, build themed galleries, and earn revenue share.
          </CardDescription>
          <div className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step} />
          </div>
        </CardHeader>
        <CardContent>
          {/* Step 1: Account */}
          {step === 1 && (
            <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
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
                  {...accountForm.register('username', { onBlur: handleUsernameBlur })}
                />
                {accountForm.formState.errors.username && (
                  <p className="text-xs text-red-400">{accountForm.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
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
                <PasswordInput
                  id="confirmPassword"
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

          {/* Step 2: Curator Profile */}
          {step === 2 && (
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

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          )}

          {/* Step 3: Choose Tier */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                    {tier.popular && (
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
                      <span className="rainbow-text">${tier.price}</span>
                      <span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      <li className="text-xs text-muted-foreground">
                        Up to {tier.artists} artists
                      </li>
                      <li className="text-xs text-muted-foreground">
                        {tier.collections} collections
                      </li>
                      <li className="text-xs text-muted-foreground">
                        {tier.revenueShare}% revenue share
                      </li>
                    </ul>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Payment collected after your account is approved.
              </p>
              <Button onClick={() => setStep(4)} className="w-full">
                Continue with{' '}
                {TIERS.find((t) => t.id === selectedTier)?.name} plan
              </Button>
            </div>
          )}

          {/* Step 4: BSV Wallet */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="glass rounded-xl p-4 space-y-2 border border-amber-400/20">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <h3 className="font-medium text-sm">BSV Wallet Required</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your revenue share payments are sent directly to your BSV address.{' '}
                  <strong className="text-white">
                    We never see your seed phrase or private key.
                  </strong>{' '}
                  If you lose them, no one can recover your funds.
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
                    {savingWallet ? 'Saving...' : 'Submit application'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
