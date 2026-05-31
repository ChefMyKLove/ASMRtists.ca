import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DollarSign, Package, Gem, TrendingUp, Images, Users, Star, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Role = 'collector' | 'artist' | 'curator' | 'admin'

interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon: React.ElementType
}

function StatCard({ label, value, subtext, icon: Icon }: StatCardProps) {
  return (
    <Card className="glass">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          {label}
          <Icon className="h-3.5 w-3.5" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold rainbow-text">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  )
}

function CollectorView() {
  // TODO: replace with supabase query — SELECT count(*) FROM orders WHERE buyer_id = user.id
  const printsOrdered = 0
  // TODO: replace with supabase query — SELECT count(*) FROM ordinals WHERE owner_id = user.id
  const ordinalsHeld = 0
  // TODO: replace with MNEE balance query via BSV address
  const mneeEarned = 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Prints Ordered" value={printsOrdered} icon={Package} subtext="All time" />
        <StatCard label="Ordinals Held" value={ordinalsHeld} icon={Gem} subtext="Digital originals" />
        <StatCard
          label="MNEE Rewards"
          value={`${mneeEarned} MNEE`}
          icon={TrendingUp}
          subtext="BSV stablecoin earned"
        />
      </div>

      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-3 text-sm">Recent Activity</h2>
        <div className="text-sm text-muted-foreground text-center py-6">
          {/* TODO: replace with supabase query — SELECT * FROM orders JOIN artworks ON orders.artwork_id = artworks.id WHERE buyer_id = user.id ORDER BY created_at DESC LIMIT 5 */}
          No recent activity yet.
        </div>
      </div>
    </div>
  )
}

function ArtistView() {
  // TODO: replace with supabase query — SELECT count(*), status FROM artworks WHERE artist_id = user.id GROUP BY status
  const totalCollections = 0
  const publishedCollections = 0
  // TODO: replace with supabase query — SELECT sum(amount_cad) FROM orders JOIN artworks ON orders.artwork_id = artworks.id WHERE artworks.artist_id = user.id AND orders.status = 'fulfilled'
  const totalSalesCad = 0
  // TODO: replace with supabase query — SELECT sum(pending_earnings_cad) FROM earnings WHERE artist_id = user.id AND paid = false
  const pendingEarningsCad = 0
  // TODO: replace with MNEE balance via BSV address on-chain
  const mneeEarned = 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Collections"
          value={totalCollections}
          icon={Images}
          subtext={`${publishedCollections} published`}
        />
        <StatCard
          label="Total Print Sales"
          value={`$${totalSalesCad.toFixed(2)}`}
          icon={DollarSign}
          subtext="CAD, all time"
        />
        <StatCard
          label="Pending Earnings"
          value={`$${pendingEarningsCad.toFixed(2)}`}
          icon={Clock}
          subtext="USD, awaiting payout"
        />
        <StatCard
          label="MNEE Earned"
          value={`${mneeEarned} MNEE`}
          icon={TrendingUp}
          subtext="BSV stablecoin"
        />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Quick Actions</h2>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/collections/upload" className={cn(buttonVariants({ size: 'sm' }))}>
            Upload New Collection
          </Link>
          <Link href="/dashboard/earnings" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            View Earnings
          </Link>
        </div>
      </div>
    </div>
  )
}

function CuratorView() {
  // TODO: replace with supabase query — SELECT count(*) FROM curator_artist_relationships WHERE curator_id = user.id
  const artistsSponsored = 0
  // TODO: replace with supabase query — SELECT count(*) FROM collections WHERE curator_id = user.id AND status = 'active'
  const activeCollections = 0
  // TODO: replace with supabase query — SELECT sum(amount) FROM curator_payouts WHERE curator_id = user.id
  const revenueShareEarned = 0
  // TODO: replace with supabase query — SELECT tier_expires_at FROM curator_profiles WHERE user_id = user.id
  const tierExpiry = 'N/A'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Artists Sponsored"
          value={artistsSponsored}
          icon={Users}
          subtext="Active relationships"
        />
        <StatCard
          label="Active Collections"
          value={activeCollections}
          icon={Images}
          subtext="Curated by you"
        />
        <StatCard
          label="Revenue Share Earned"
          value={`$${revenueShareEarned.toFixed(2)}`}
          icon={DollarSign}
          subtext="CAD, all time"
        />
        <StatCard
          label="Tier Expiry"
          value={tierExpiry}
          icon={Star}
          subtext="Renews automatically"
        />
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Quick Actions</h2>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/curate" className={cn(buttonVariants({ size: 'sm' }))}>
            My Gallery
          </Link>
          <Link href="/dashboard/curate/artists" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Manage Artists
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, active_role')
    .eq('id', user!.id)
    .single()

  const displayName = profile?.display_name ?? user?.email ?? 'there'
  const role = (profile?.active_role ?? 'collector') as Role

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Here&apos;s a snapshot of your activity.
        </p>
      </div>

      {role === 'collector' && <CollectorView />}
      {role === 'artist' && <ArtistView />}
      {role === 'curator' && <CuratorView />}
      {role === 'admin' && <ArtistView />}
    </div>
  )
}
