import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Curate — Dashboard' }

export default function CuratePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Curate</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Champion artists and earn a 10% revenue share on their sales.
        </p>
      </div>

      <div className="glass rounded-xl p-8 text-center space-y-3">
        <p className="text-muted-foreground text-sm">
          Curator features are coming soon.
        </p>
        <p className="text-xs text-muted-foreground">
          You&apos;ll be able to link artists to your curator profile and receive automatic MNEE
          distributions when their work sells.
        </p>
      </div>
    </div>
  )
}
