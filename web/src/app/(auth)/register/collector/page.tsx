'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Wallet, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { MultiStepForm } from '@/components/auth/multi-step-form'
import { createClient } from '@/lib/supabase/client'
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

type AccountValues = z.infer<typeof accountSchema>

const STEPS = ['Account', 'Wallet']

export default function RegisterCollectorPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [wallet, setWallet] = useState<WalletResult | null>(null)
  const [seedVisible, setSeedVisible] = useState(false)
  const [seedConfirmed, setSeedConfirmed] = useState(false)
  const [savingWallet, setSavingWallet] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: { username: '', displayName: '', email: '', password: '', confirmPassword: '' },
  })

  function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const emailVal = e.target.value
    const username = watch('username')
    if (!username && emailVal.includes('@')) {
      const suggested = emailVal
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .slice(0, 32)
      setValue('username', suggested, { shouldValidate: true })
    }
  }

  function handleUsernameBlur(e: React.FocusEvent<HTMLInputElement>) {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32)
    setValue('username', sanitized, { shouldValidate: true })
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
          role: 'collector',
        },
      },
    })

    if (error) {
      setServerError(error.message)
      return
    }

    setStep(2)
  }

  function handleGenerateWallet() {
    const result = generateWallet()
    setWallet(result)
    setSeedVisible(false)
    setSeedConfirmed(false)
  }

  async function handleSaveWallet() {
    if (!wallet) return
    setSavingWallet(true)
    try {
      const res = await fetch('/api/wallet/save-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet.address }),
      })
      if (!res.ok) throw new Error('Failed to save wallet')
    } catch {
      setServerError('Could not save wallet address. You can add it later in your profile.')
    } finally {
      setSavingWallet(false)
      router.push('/dashboard')
      router.refresh()
    }
  }

  function handleSkip() {
    router.push('/dashboard')
    router.refresh()
  }

  const words = wallet ? wallet.mnemonic.split(' ') : []

  return (
    <div className="w-full max-w-lg">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Create Collector Account</CardTitle>
          <CardDescription>Own verifiable digital originals and order prints.</CardDescription>
          <div className="pt-4">
            <MultiStepForm steps={STEPS} currentStep={step} />
          </div>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <form onSubmit={handleSubmit(onAccountSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="bg-white/5 border-white/10"
                  {...register('email', { onBlur: handleEmailBlur })}
                />
                {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your Name"
                  autoComplete="name"
                  className="bg-white/5 border-white/10"
                  {...register('displayName')}
                />
                {errors.displayName && (
                  <p className="text-xs text-red-400">{errors.displayName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="your-username"
                  autoComplete="username"
                  className="bg-white/5 border-white/10"
                  {...register('username', { onBlur: handleUsernameBlur })}
                />
                {errors.username && (
                  <p className="text-xs text-red-400">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  className="bg-white/5 border-white/10"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  className="bg-white/5 border-white/10"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                  {serverError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Continue'}
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="glass rounded-xl p-4 space-y-2">
                <h3 className="font-medium text-sm">Optional: BSV Wallet</h3>
                <p className="text-xs text-muted-foreground">
                  Want to collect digital originals and earn MNEE rewards? Connect a BSV wallet.
                  You can always add one later from your profile.
                </p>
              </div>

              {!wallet ? (
                <div className="space-y-3">
                  <Button onClick={handleGenerateWallet} className="w-full" variant="outline">
                    <Wallet className="h-4 w-4 mr-2" />
                    Generate a new wallet
                  </Button>
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    className="w-full text-muted-foreground"
                  >
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip for now
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Your seed phrase</p>
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
                      I have saved my seed phrase in a safe place. I understand that if I lose it,
                      no one can recover my funds.
                    </span>
                  </label>

                  {serverError && (
                    <p className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                      {serverError}
                    </p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveWallet}
                      className="flex-1"
                      disabled={!seedConfirmed || savingWallet}
                    >
                      {savingWallet ? 'Saving...' : 'Save wallet & continue'}
                    </Button>
                    <Button onClick={handleSkip} variant="ghost" className="text-muted-foreground">
                      Skip
                    </Button>
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
