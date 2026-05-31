import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background/50 py-10 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div>
            <p className="rainbow-text font-semibold mb-3">ASMRtists.ca</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Blockchain-native marketplace for independent artists.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Explore</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/browse" className="hover:text-white transition-colors">Browse Art</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Create</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/register/artist" className="hover:text-white transition-colors">Join as Artist</Link></li>
              <li><Link href="/register/curator" className="hover:text-white transition-colors">Join as Curator</Link></li>
              <li><Link href="/register/collector" className="hover:text-white transition-colors">Join as Collector</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium mb-3">Platform</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ASMRtists.ca — All rights reserved</p>
          <p>Powered by BSV Blockchain &amp; MNEE</p>
        </div>
      </div>
    </footer>
  )
}
