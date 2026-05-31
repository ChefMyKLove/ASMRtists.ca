import type { Metadata } from 'next'
import { BrowseClient } from './browse-client'

export const metadata: Metadata = {
  title: 'Browse — ASMRtists.ca',
  description: 'Discover independent artists and their original work. Filter by curator, collection, prints, and ordinals.',
}

// TODO: Replace with supabase.from('artist_profiles').select('*, artworks(*), collections(*)')
//       .eq('is_active', true).order('is_featured', { ascending: false })
const placeholderArtists = [
  {
    slug: 'aurora-vex',
    displayName: 'Aurora Vex',
    bio: 'Digital surrealist exploring the boundaries between sound and colour.',
    artworkCount: 12,
    isFeatured: true,
    hasPrints: true,
    hasOrdinals: true,
    collectionName: 'Chromatic Drift',
    curatorName: 'Neon Curators',
    bannerUrl: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80',
  },
  {
    slug: 'neon-moth',
    displayName: 'Neon Moth',
    bio: 'Generative art grounded in BSV blockchain inscription.',
    artworkCount: 8,
    isFeatured: false,
    hasPrints: false,
    hasOrdinals: true,
    collectionName: 'Signal Series',
    curatorName: 'Block Gallery',
    bannerUrl: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=200&q=80',
  },
  {
    slug: 'lunar-press',
    displayName: 'Lunar Press',
    bio: 'Fine art prints with a pastel, dreamlike quality.',
    artworkCount: 24,
    isFeatured: false,
    hasPrints: true,
    hasOrdinals: false,
    collectionName: 'Dreamscapes',
    curatorName: 'Pastel Collective',
    bannerUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80',
  },
  {
    slug: 'verdant-echo',
    displayName: 'Verdant Echo',
    bio: 'Nature-inspired digital paintings that blur the line between photography and illustration.',
    artworkCount: 17,
    isFeatured: false,
    hasPrints: true,
    hasOrdinals: true,
    collectionName: 'Forest Frequencies',
    curatorName: 'Neon Curators',
    bannerUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
  },
  {
    slug: 'prism-flux',
    displayName: 'Prism Flux',
    bio: 'Kaleidoscopic abstract works exploring light diffraction and colour theory.',
    artworkCount: 6,
    isFeatured: false,
    hasPrints: true,
    hasOrdinals: false,
    collectionName: 'Refraction Studies',
    curatorName: 'Block Gallery',
    bannerUrl: 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  },
  {
    slug: 'deep-violet',
    displayName: 'Deep Violet',
    bio: 'Dark ambient aesthetics translated into richly textured digital compositions.',
    artworkCount: 31,
    isFeatured: false,
    hasPrints: false,
    hasOrdinals: true,
    collectionName: 'Void Studies',
    curatorName: 'Pastel Collective',
    bannerUrl: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=600&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&q=80',
  },
]

export default function BrowsePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Browse Artists</h1>
        <p className="text-muted-foreground">
          Discover independent artists and their original work.
        </p>
      </div>

      {/* Client component handles search + filter interactivity */}
      <BrowseClient artists={placeholderArtists} />
    </div>
  )
}
