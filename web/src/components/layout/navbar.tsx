'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { WalletConnector } from '@/components/wallet/wallet-connector'

const navLinks = [
  { href: '/browse', label: 'Browse' },
  { href: '/ordinals', label: 'Marketplace' },
  { href: '/about', label: 'About' },
]

interface NavbarProps {
  user?: {
    id: string
    email?: string
    avatarUrl?: string
    displayName?: string
  } | null
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-[#100e09]/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,220,180,0.08)]">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-lg tracking-tight"
        >
          <span className="rainbow-text">ASMRtists</span>
          <span className="text-muted-foreground text-sm">.ca</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                pathname === link.href
                  ? 'bg-white/10 text-white'
                  : 'text-muted-foreground hover:text-white hover:bg-white/5'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          <WalletConnector />
          {user ? (
            <Link href="/dashboard">
              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-white/20 hover:ring-white/40 transition-all">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="text-xs bg-white/10">
                  {user.displayName?.slice(0, 2).toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                Log in
              </Link>
              <Link
                href="/get-started"
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'bg-white text-black hover:bg-white/90'
                )}
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet>
          <SheetTrigger
            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-background/95 backdrop-blur">
            <SheetHeader>
              <SheetTitle className="rainbow-text text-left">ASMRtists.ca</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-2 text-sm rounded-md transition-colors',
                    pathname === link.href
                      ? 'bg-white/10 text-white'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-4 flex flex-col gap-2">
                <WalletConnector />
                {user ? (
                  <Link
                    href="/dashboard"
                    className="px-3 py-2 text-sm rounded-md bg-white/10 text-white"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/get-started"
                      className={cn(
                        buttonVariants({ size: 'sm' }),
                        'bg-white text-black hover:bg-white/90'
                      )}
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
