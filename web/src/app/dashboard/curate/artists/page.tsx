import { Users } from 'lucide-react'

export default function CurateArtistsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <div className="rounded-full bg-white/5 p-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold mb-1">Sponsored Artists</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Artist sponsorship management is coming soon. You&apos;ll be able to sponsor artists and feature their work in your gallery here.
        </p>
      </div>
    </div>
  )
}
