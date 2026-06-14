'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getAdminPendingCollectionsAction,
  adminApproveCollectionAction,
  adminRejectCollectionAction,
  type AdminPendingCollection,
} from '@/app/actions/collections'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Users,
  Layers,
  Flag,
  Wallet,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id: string
  user_id: string
  role: string
  status: string
  created_at: string
  display_name: string | null
  email: string | null
  bio: string | null
}


interface ContentFlag {
  id: string
  artwork_id: string | null
  reason: string
  status: string
  created_at: string
  artwork_title: string | null
}

type Tab = 'approvals' | 'collections' | 'flags' | 'treasury'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'approvals', label: 'Pending Approvals', icon: Users },
  { id: 'collections', label: 'Collections Queue', icon: Layers },
  { id: 'flags', label: 'Content Flags', icon: Flag },
  { id: 'treasury', label: 'Treasury', icon: Wallet },
]

// ─── Pending Approvals tab ────────────────────────────────────────────────────

function ApprovalsTab() {
  const supabase = createClient()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    // Join user_roles with profiles to get name/bio
    const { data } = await supabase
      .from('user_roles')
      .select('id, user_id, role, status, created_at, profiles(display_name, bio)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    setApplications(
      (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        display_name: row.profiles?.display_name ?? null,
        email: null,
        bio: row.profiles?.bio ?? null,
      }))
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string, userId: string, role: string) {
    await supabase.from('user_roles').update({ status: 'active' }).eq('id', id)
    // Update artist_profiles if artist
    if (role === 'artist') {
      await supabase.from('artist_profiles').update({ status: 'active' }).eq('user_id', userId)
    }
    load()
  }

  async function handleReject(id: string) {
    await supabase.from('user_roles').update({ status: 'rejected' }).eq('id', id)
    load()
  }

  if (loading) return <Spinner />

  if (applications.length === 0) {
    return <EmptyMessage>No pending applications.</EmptyMessage>
  }

  return (
    <div className="space-y-2">
      {applications.map((app) => (
        <div key={app.id} className="glass rounded-xl p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{app.display_name ?? 'Unknown'}</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                {app.role}
              </span>
            </div>
            {app.bio && (
              <p className="text-xs text-muted-foreground line-clamp-2">{app.bio}</p>
            )}
            <p className="text-[10px] text-white/30">
              {new Date(app.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleApprove(app.id, app.user_id, app.role)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-red-400 hover:bg-red-500/10"
              onClick={() => handleReject(app.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Collections Queue tab ────────────────────────────────────────────────────

function CollectionsQueueTab() {
  const [collections, setCollections] = useState<AdminPendingCollection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { collections: data } = await getAdminPendingCollectionsAction()
    setCollections(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string) {
    await adminApproveCollectionAction(id)
    load()
  }

  async function handleReject(id: string) {
    await adminRejectCollectionAction(id)
    load()
  }

  if (loading) return <Spinner />

  if (collections.length === 0) {
    return <EmptyMessage>No collections pending review.</EmptyMessage>
  }

  return (
    <div className="space-y-2">
      {collections.map((coll) => (
        <div key={coll.id} className="glass rounded-xl p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{coll.title}</p>
            <p className="text-xs text-muted-foreground">
              {coll.artist_name ?? 'Unknown artist'} · {coll.piece_count} pieces ·{' '}
              {new Date(coll.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleApprove(coll.id)}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-red-400 hover:bg-red-500/10"
              onClick={() => handleReject(coll.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Content Flags tab ────────────────────────────────────────────────────────

function ContentFlagsTab() {
  const supabase = createClient()
  const [flags, setFlags] = useState<ContentFlag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('content_flags')
      .select('id, artwork_id, reason, status, created_at, artwork(title)')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(50)

    setFlags(
      (data ?? []).map((row: any) => ({
        id: row.id,
        artwork_id: row.artwork_id,
        reason: row.reason,
        status: row.status,
        created_at: row.created_at,
        artwork_title: row.artwork?.title ?? null,
      }))
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function handleResolve(id: string, resolution: 'dismissed' | 'actioned') {
    await supabase.from('content_flags').update({ status: resolution }).eq('id', id)
    load()
  }

  if (loading) return <Spinner />

  if (flags.length === 0) {
    return <EmptyMessage>No open content flags.</EmptyMessage>
  }

  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <div key={flag.id} className="glass rounded-xl p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm font-medium">
              {flag.artwork_title ? `Artwork: ${flag.artwork_title}` : 'Unknown artwork'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">{flag.reason}</p>
            <p className="text-[10px] text-white/30">
              {new Date(flag.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-white/60 hover:text-white"
              onClick={() => handleResolve(flag.id, 'dismissed')}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-red-400 hover:bg-red-500/10"
              onClick={() => handleResolve(flag.id, 'actioned')}
            >
              Action
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Treasury tab ─────────────────────────────────────────────────────────────

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_MNEE_TREASURY_ADDRESS ?? ''

function TreasuryTab() {
  const [balance, setBalance] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [distributing, setDistributing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // Fetch pending claims count
    supabase
      .from('ordinal_claims')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0))
  }, [supabase])

  async function handleDistribute() {
    setDistributing(true)
    setResult(null)
    try {
      const res = await fetch('/api/mnee/distribute', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setResult(`Distributed to ${json.recipientCount} recipients. Ticket: ${json.ticketId}`)
      } else {
        setResult(`Error: ${json.error}`)
      }
    } catch (err) {
      setResult('Network error. Try again.')
    } finally {
      setDistributing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Treasury
        </h3>
        {TREASURY_ADDRESS ? (
          <p className="text-xs text-muted-foreground font-mono">{TREASURY_ADDRESS}</p>
        ) : (
          <p className="text-xs text-amber-400">
            NEXT_PUBLIC_MNEE_TREASURY_ADDRESS not set.
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold rainbow-text">
            {balance !== null ? `${balance} MNEE` : '—'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Pending distributions: {pendingCount !== null ? pendingCount : '…'}
        </div>
      </div>

      {result && (
        <div className="glass rounded-xl p-4 text-xs text-white/70">{result}</div>
      )}

      <Button
        onClick={handleDistribute}
        disabled={distributing || !pendingCount}
        className="gap-2"
      >
        {distributing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Trigger Distribution
      </Button>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-white/30" />
    </div>
  )
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

// ─── Main admin page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('approvals')

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors',
              activeTab === id
                ? 'bg-white/15 text-white font-medium'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'approvals' && <ApprovalsTab />}
      {activeTab === 'collections' && <CollectionsQueueTab />}
      {activeTab === 'flags' && <ContentFlagsTab />}
      {activeTab === 'treasury' && <TreasuryTab />}
    </div>
  )
}
