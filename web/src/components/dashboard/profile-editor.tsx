'use client'

import React, { useState, useTransition, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ProfileWalletSection } from '@/components/wallet/profile-wallet-section'
import { updateProfileAction, updateArtistProfileAction } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'
import {
  Camera,
  ImageIcon,
  Check,
  AlertCircle,
  ExternalLink,
  Link2,
  AtSign,
  Globe,
  Gem,
  ShoppingBag,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ArtistProfileData {
  stage_name: string | null
  bio: string | null
  location: string | null
  status: string
  piece_count: number
}

interface ProfileEditorProps {
  userId: string
  username: string
  email: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  socialLinks: { twitter?: string; instagram?: string; website?: string }
  bsvAddress: string | null
  artistProfile: ArtistProfileData | null
  userRoles: { role: string; status: string }[]
}

const ROLE_COLORS: Record<string, string> = {
  artist: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  curator: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  collector: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  admin: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
}

function extractHandle(value: string, domains: string[]): string {
  for (const domain of domains) {
    const m = value.match(new RegExp(`${domain}/([^/?#]+)`, 'i'))
    if (m) return m[1].replace(/\/$/, '')
  }
  return value.replace(/^@/, '').trim()
}

const ARTIST_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  suspended: 'bg-red-500/20 text-red-300',
}

export function ProfileEditor({
  userId,
  username,
  email,
  displayName: initialDisplayName,
  bio: initialBio,
  avatarUrl: initialAvatarUrl,
  bannerUrl: initialBannerUrl,
  socialLinks: initialSocialLinks,
  bsvAddress,
  artistProfile,
  userRoles,
}: ProfileEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [bio, setBio] = useState(initialBio ?? '')
  const [stageName, setStageName] = useState(artistProfile?.stage_name ?? '')
  const [location, setLocation] = useState(artistProfile?.location ?? '')
  const [twitter, setTwitter] = useState(initialSocialLinks.twitter ?? '')
  const [instagram, setInstagram] = useState(initialSocialLinks.instagram ?? '')
  const [website, setWebsite] = useState(initialSocialLinks.website ?? '')

  // Image state
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Save state
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  async function uploadImage(
    file: File,
    path: string,
    onUrl: (url: string) => void,
    setUploading: (v: boolean) => void,
  ) {
    setImageError(null)
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const storagePath = `${userId}/profile/${path}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('artwork-originals')
        .upload(storagePath, file, { upsert: true, contentType: file.type })

      if (uploadErr) {
        setImageError(uploadErr.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('artwork-originals')
        .getPublicUrl(storagePath)

      onUrl(publicUrl)

      const field = path === 'avatar' ? 'avatar_url' : 'banner_url'
      const { error } = await updateProfileAction({ [field]: publicUrl })
      if (error) { setImageError(error); return }
      if (artistProfile) {
        const { error: artistErr } = await updateArtistProfileAction({ [field]: publicUrl })
        if (artistErr) setImageError(artistErr)
      }
    } finally {
      setUploading(false)
    }
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Local preview
    const localUrl = URL.createObjectURL(file)
    setAvatarUrl(localUrl)
    uploadImage(file, 'avatar', setAvatarUrl, setAvatarUploading)
  }

  function handleBannerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setBannerUrl(localUrl)
    uploadImage(file, 'banner', setBannerUrl, setBannerUploading)
  }

  async function handleSave() {
    setSaveError(null)
    setSaved(false)
    const { error } = await updateProfileAction({
      display_name: displayName || undefined,
      bio: bio || undefined,
      social_links: {
        ...(twitter ? { twitter: extractHandle(twitter, ['twitter.com', 'x.com']) } : {}),
        ...(instagram ? { instagram: extractHandle(instagram, ['instagram.com']) } : {}),
        ...(website ? { website } : {}),
      },
    })
    if (error) {
      setSaveError(error)
      return
    }
    if (artistProfile) {
      const { error: artistErr } = await updateArtistProfileAction({
        stage_name: stageName || undefined,
        bio: bio || undefined,
        location: location || undefined,
      })
      if (artistErr) {
        setSaveError(artistErr)
        return
      }
    }
    setSaved(true)
    startTransition(() => {
      router.refresh()
    })
    setTimeout(() => setSaved(false), 3000)
  }

  const initials = (displayName || username || 'U').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your public profile, images, and wallet.
        </p>
      </div>

      {/* ── Banner + Avatar ─────────────────────────────────────── */}
      <div className="glass rounded-xl overflow-hidden">
        {/* Banner */}
        <div className="relative h-36 bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40 group">
          {bannerUrl && (
            <Image src={bannerUrl} alt="Banner" fill className="object-cover" sizes="672px" />
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {bannerUploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full hover:bg-black/80 transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Change Banner
              </button>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            title="Upload banner image"
            onChange={handleBannerFile}
          />
        </div>

        {/* Avatar + identity row */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between gap-4 -mt-8 mb-4">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <Avatar className="h-16 w-16 ring-4 ring-[#0a0a0f]">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-white/10 text-base">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={avatarUploading}
              >
                {avatarUploading
                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                  : <Camera className="h-4 w-4 text-white" />
                }
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                title="Upload profile photo"
                onChange={handleAvatarFile}
              />
            </div>

            {/* Roles */}
            <div className="flex flex-wrap gap-1.5 pb-1">
              {userRoles.filter(r => r.status === 'active').map(r => (
                <span
                  key={r.role}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
                    ROLE_COLORS[r.role] ?? 'bg-white/10 text-white/60 border-white/10'
                  )}
                >
                  {r.role}
                </span>
              ))}
            </div>
          </div>

          {/* Name + username */}
          <div className="space-y-0.5 mb-3">
            <p className="font-semibold text-sm">{displayName || username}</p>
            <p className="text-xs text-muted-foreground">@{username}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>

          {/* Public profile link */}
          <a
            href={`/artists/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View public profile
          </a>
        </div>
      </div>

      {imageError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {imageError}
        </div>
      )}

      {/* ── Edit Identity ───────────────────────────────────────── */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h2 className="font-semibold">Public Identity</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Display Name</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="bg-white/5 border-white/10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Username (URL slug)</Label>
            <Input
              value={`@${username}`}
              readOnly
              className="bg-white/5 border-white/10 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Bio</Label>
          <Textarea
            value={bio}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBio(e.target.value)}
            placeholder="Tell collectors about your work..."
            rows={3}
            className="bg-white/5 border-white/10 text-sm resize-none"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Social Links</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Twitter / X
              </Label>
              <Input
                value={twitter}
                onChange={e => setTwitter(e.target.value)}
                placeholder="username"
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <AtSign className="h-3 w-3" /> Instagram
              </Label>
              <Input
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="username or full URL"
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" /> Website
              </Label>
              <Input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {saveError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            onClick={handleSave}
            disabled={isPending}
            size="sm"
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Changes
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* ── Artist Profile ──────────────────────────────────────── */}
      {artistProfile && (
        <div className="glass rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Artist Profile</h2>
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
              ARTIST_STATUS_COLORS[artistProfile.status] ?? 'bg-white/10 text-white/60'
            )}>
              {artistProfile.status}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stage Name</Label>
              <Input
                value={stageName}
                onChange={e => setStageName(e.target.value)}
                placeholder="Your artist name"
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, Country"
                className="bg-white/5 border-white/10 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-xl font-bold rainbow-text">{artistProfile.piece_count}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <ImageIcon className="h-3 w-3" /> Pieces uploaded
              </p>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-emerald-400">
                {artistProfile.status === 'active' ? '✓' : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <ShoppingBag className="h-3 w-3" /> Listed on Shopify
              </p>
            </div>
          </div>

          {artistProfile.status === 'pending' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80">
                Your artist profile is pending review. Once approved, your collections will go live on the marketplace.
              </p>
            </div>
          )}

          <Link
            href="/dashboard/collections"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <Gem className="h-3 w-3" />
            Manage your collections →
          </Link>
        </div>
      )}

      {/* ── Wallet ─────────────────────────────────────────────── */}
      <ProfileWalletSection bsvAddress={bsvAddress} />
    </div>
  )
}
