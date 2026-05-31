import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ShoppingBag, Palette, Eye, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const roles = [
  {
    href: '/register/collector',
    icon: ShoppingBag,
    title: 'Collector',
    tagline: 'Discover and own digital art',
    bullets: [
      'Browse prints from independent artists',
      'Buy ordinals — verifiable on-chain originals',
      'Earn MNEE rewards from your holdings',
      'No wallet required to start',
    ],
    cta: 'Join as Collector',
    accent: 'from-blue-400 to-cyan-400',
  },
  {
    href: '/register/artist',
    icon: Palette,
    title: 'Artist',
    tagline: 'Share your work with the world',
    bullets: [
      'Upload collections and reach global buyers',
      'Get museum-quality prints sold worldwide',
      'Earn fiat via Stripe + on-chain MNEE rewards',
      'Requires BSV wallet (generated during signup)',
    ],
    cta: 'Join as Artist',
    accent: 'from-purple-400 to-pink-400',
  },
  {
    href: '/register/curator',
    icon: Eye,
    title: 'Curator',
    tagline: 'Build your gallery',
    bullets: [
      'Sponsor artists and create themed collections',
      'Earn revenue share on every sale you drive',
      'Paid tiers from \$29/mo',
      'Requires BSV wallet',
    ],
    cta: 'Join as Curator',
    accent: 'from-orange-400 to-amber-300',
  },
]

export default function GetStartedPage() {
  return (
    <div className="w-full max-w-4xl space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Join ASMRtists.ca</h1>
        <p className="text-muted-foreground">Choose how you want to participate</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {roles.map((role) => {
          const Icon = role.icon
          return (
            <Card
              key={role.href}
              className="glass hover:ring-1 hover:ring-white/20 transition-all flex flex-col"
            >
              <CardHeader className="pb-3">
                <div
                  className={`h-10 w-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3 ${role.accent}`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-base">{role.title}</CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">{role.tagline}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <ul className="space-y-2 flex-1">
                  {role.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-green-400" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href={role.href}
                  className={cn(buttonVariants({ size: 'sm' }), 'w-full')}
                >
                  {role.cta}
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-white hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
