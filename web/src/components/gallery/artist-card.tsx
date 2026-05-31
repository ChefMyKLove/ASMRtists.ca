import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ArtistCardProps {
  slug: string
  displayName: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  bio?: string | null
  artworkCount: number
  isFeatured?: boolean
  /** Pass true for the first card above the fold to improve LCP */
  priority?: boolean
}

export function ArtistCard({
  slug,
  displayName,
  avatarUrl,
  bannerUrl,
  bio,
  artworkCount,
  isFeatured,
  priority = false,
}: ArtistCardProps) {
  return (
    <Link href={`/artists/${slug}`} className="block group">
      <Card className="glass overflow-hidden hover:ring-1 hover:ring-white/20 transition-all duration-200">
        {/* Banner */}
        <div className="relative h-28 bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40">
          {bannerUrl && (
            <Image
              src={bannerUrl}
              alt={`${displayName} banner`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
              priority={priority}
            />
          )}
          {isFeatured && (
            <Badge className="absolute top-2 right-2 bg-white/20 text-white text-xs">
              Featured
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          {/* Avatar overlapping banner */}
          <div className="-mt-8 mb-3">
            <Avatar className="h-14 w-14 ring-2 ring-background">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="bg-white/10 text-sm">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <p className="font-semibold text-sm group-hover:text-white transition-colors">
            {displayName}
          </p>

          {bio && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {bio}
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {artworkCount} {artworkCount === 1 ? 'artwork' : 'artworks'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
