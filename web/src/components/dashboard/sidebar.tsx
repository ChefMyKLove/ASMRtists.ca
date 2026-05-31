'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  User,
  Coins,
  Images,
  Gem,
  Eye,
  Users,
  ShieldAlert,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

type Role = 'collector' | 'artist' | 'curator' | 'admin'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

const baseNav: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
  { href: '/dashboard/earnings', icon: Coins, label: 'Earnings' },
]

const artistNav: NavItem[] = [
  { href: '/dashboard/collections', icon: Images, label: 'Collections' },
  { href: '/dashboard/ordinals', icon: Gem, label: 'Ordinals' },
]

const curatorNav: NavItem[] = [
  { href: '/dashboard/curate', icon: Eye, label: 'My Gallery' },
  { href: '/dashboard/curate/artists', icon: Users, label: 'Sponsored Artists' },
]

const adminNav: NavItem[] = [
  { href: '/admin', icon: ShieldAlert, label: 'Admin Panel' },
]

function navItemsForRole(role: Role): NavItem[] {
  const items = [...baseNav]
  if (role === 'artist' || role === 'admin') items.push(...artistNav)
  if (role === 'curator' || role === 'admin') items.push(...curatorNav)
  if (role === 'admin') items.push(...adminNav)
  return items
}

interface SidebarContentProps {
  activeRole: Role
  displayName: string
  avatarUrl: string | null
  email: string
  onNavigate?: () => void
}

function SidebarContent({
  activeRole,
  displayName,
  avatarUrl,
  email,
  onNavigate,
}: SidebarContentProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = navItemsForRole(activeRole)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <Link
        href="/"
        className="rainbow-text font-semibold text-base mb-6 px-2 block"
        onClick={onNavigate}
      >
        ASMRtists.ca
      </Link>

      {/* Role badge */}
      <div className="px-2 mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {activeRole}
        </span>
      </div>

      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 text-sm rounded-lg transition-colors',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="pt-4 border-t border-white/10 space-y-2">
        {/* User info */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold">{displayName[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        <button
          type="button"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'w-full justify-start gap-2 text-muted-foreground hover:text-white'
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  )
}

interface DashboardSidebarProps {
  activeRole: string
  displayName: string
  avatarUrl: string | null
  email: string
}

export function DashboardSidebar({
  activeRole,
  displayName,
  avatarUrl,
  email,
}: DashboardSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const role = activeRole as Role

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-white/10 bg-background/50 p-4 sticky top-0 h-screen">
        <SidebarContent
          activeRole={role}
          displayName={displayName}
          avatarUrl={avatarUrl}
          email={email}
        />
      </aside>

      {/* Mobile: floating trigger + Sheet */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="inline-flex items-center justify-center h-9 w-9 rounded-lg glass border border-white/10 text-white hover:bg-white/10 transition-colors">
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </SheetTrigger>
          <SheetContent side="left" className="w-56 glass border-white/10 p-4">
            <SidebarContent
              activeRole={role}
              displayName={displayName}
              avatarUrl={avatarUrl}
              email={email}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
