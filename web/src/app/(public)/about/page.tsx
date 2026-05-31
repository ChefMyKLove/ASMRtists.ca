import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AudienceCarousel } from '@/components/splash/audience-carousel'

export const metadata: Metadata = {
  title: 'About — ASMRtists.ca',
  description:
    'ASMRtists is a print house representing a growing roster of artists — on paper, poster and canvas, printed on demand for every order.',
}

const artistSteps = [
  {
    step: '01',
    title: 'Create your profile',
    body: 'Sign up, choose a stage name, and upload a banner and bio. Your page becomes your public gallery.',
  },
  {
    step: '02',
    title: 'Upload your collection',
    body: 'Add artworks with titles, descriptions, and pricing. We handle thumbnail generation and the print-ready files stay yours.',
  },
  {
    step: '03',
    title: 'Get paid automatically',
    body: 'Every print sale triggers an automatic fiat payout via Stripe Connect. Ordinal sales deliver MNEE directly to your BSV wallet.',
  },
]

const collectorSteps = [
  {
    step: '01',
    title: 'Browse the marketplace',
    body: 'Explore artists filtered by medium, style, or availability as prints or ordinals. No wallet required to browse.',
  },
  {
    step: '02',
    title: 'Own a 1Sat Ordinal',
    body: 'Connect a BSV wallet and purchase an ordinal inscription. The artwork is permanently recorded on-chain with your address as provenance.',
  },
  {
    step: '03',
    title: 'Order a print',
    body: 'Click "Buy Print" on any artwork to open the ASMRprints.com store. Museum-quality giclée prints shipped worldwide — no Bitcoin wallet required.',
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 sm:py-28 space-y-16">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          About · Est. 2025
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
          Your collectors are your biggest promoters.
        </h1>
      </div>

      {/* ── Core copy ─────────────────────────────────────────── */}
      <div className="space-y-6 text-lg leading-relaxed text-foreground/85 font-light">
        <p>
          ASMRtists is built around a novel concept: the people who collect your
          work are also the best people to promote it — especially when they&rsquo;re
          rewarded every time it sells.
        </p>
        <p>
          Introducing our <strong className="font-medium">Proof-of-Patron</strong> rewards
          model. When a digital collector mints the 1Sat Ordinal of one of your
          pieces, they become invested in its success. Holders of these on-chain
          digital artifacts are compensated every time a physical print of that
          piece sells — and can cash in their rewards at any time, or keep them
          attached to the Ordinal, increasing its resale value.
        </p>
        <p>
          Throughout all of this, the artist is fairly compensated for every sale
          of their physical work through the ASMRtists portal, and earns royalties
          on every resale of their digital artifacts. The work keeps paying.
        </p>

        {/* ── Audience carousel ─────────────────────────────── */}
        <AudienceCarousel />

        <p className="pt-2">
          Get in touch at{' '}
          <a className="underline underline-offset-4" href="mailto:hello@asmrtists.ca">
            hello@asmrtists.ca
          </a>{' '}
          if you think you have what it takes. To get started,{' '}
          <a className="underline underline-offset-4" href="https://asmrtists.ca">
            sign up at ASMRtists.ca
          </a>
          .
        </p>
      </div>

      {/* ── Format footer strip ───────────────────────────────── */}
      <div className="grid grid-cols-3 gap-8 border-t border-border/60 pt-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Formats</p>
          <p className="mt-2 text-xl font-semibold">Paper · Poster · Canvas</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Print runs</p>
          <p className="mt-2 text-xl font-semibold">Open &amp; on-demand</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Digital</p>
          <p className="mt-2 text-xl font-semibold">1Sat Ordinals on BSV</p>
        </div>
      </div>

      {/* ── How it works: Artists ─────────────────────────────── */}
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">For Artists</p>
          <h2 className="text-2xl font-semibold">
            From upload to payday in three steps
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {artistSteps.map((item) => (
            <div key={item.step} className="glass rounded-2xl p-6 space-y-3">
              <p className="text-3xl font-bold text-[#c4b0ff]/60">{item.step}</p>
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works: Collectors ──────────────────────────── */}
      <div className="space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">For Collectors</p>
          <h2 className="text-2xl font-semibold">
            Own art on-chain or on your wall
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {collectorSteps.map((item) => (
            <div key={item.step} className="glass rounded-2xl p-6 space-y-3">
              <p className="text-3xl font-bold text-[#c4b0ff]/60">{item.step}</p>
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Revenue model ─────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">How the revenue model works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-[#c4b0ff]">◎</span>
              <h3 className="font-semibold">Print sales → Fiat to artists</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a collector orders a print, ASMRprints.com fulfills the order. A portion of
              each sale is automatically routed to the artist&rsquo;s Stripe Connect account in CAD or USD.
              No Bitcoin wallet needed by the collector.
            </p>
            <div className="flex gap-6 pt-1">
              <div>
                <p className="text-lg font-semibold text-[#c4b0ff]">70%</p>
                <p className="text-xs text-muted-foreground">to Artist</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white/60">15%</p>
                <p className="text-xs text-muted-foreground">to Curator</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white/30">15%</p>
                <p className="text-xs text-muted-foreground">Platform fee</p>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-[#ffb3d1]">◆</span>
              <h3 className="font-semibold">Ordinal sales → MNEE rewards</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When an ordinal is purchased, MNEE (a USD-pegged BSV stablecoin) is sent directly
              to the artist&rsquo;s BSV wallet on-chain. The inscription is transferred atomically —
              payment and delivery happen in the same transaction.
            </p>
            <div className="flex gap-6 pt-1">
              <div>
                <p className="text-lg font-semibold text-[#c4b0ff]">80%</p>
                <p className="text-xs text-muted-foreground">to Artist</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white/60">10%</p>
                <p className="text-xs text-muted-foreground">to Curator</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-white/30">10%</p>
                <p className="text-xs text-muted-foreground">Platform fee</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          * Revenue splits are indicative. Final splits are set per-collection at onboarding and
          are inscribed on-chain at mint time.
        </p>
      </div>

      {/* ── Roles CTA ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            role: 'Artist',
            desc: 'Upload your work, set your prices, earn on every print and digital sale.',
            cta: 'Join as Artist',
            href: '/register/artist',
            color: 'text-[#c4b0ff]',
          },
          {
            role: 'Curator',
            desc: 'Champion artists you believe in, build collections, and earn a rev-share.',
            cta: 'Join as Curator',
            href: '/register/curator',
            color: 'text-[#ffb3d1]',
          },
          {
            role: 'Collector',
            desc: 'Own verifiable digital originals on-chain or order high-quality prints for your walls.',
            cta: 'Start collecting',
            href: '/browse',
            color: 'text-[#b3f0c8]',
          },
        ].map((r) => (
          <div key={r.role} className="glass rounded-2xl p-6 space-y-3 flex flex-col">
            <h3 className={`font-semibold text-lg ${r.color}`}>{r.role}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{r.desc}</p>
            <Link
              href={r.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'border-white/20 hover:bg-white/5 mt-2 w-full justify-center',
              )}
            >
              {r.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
