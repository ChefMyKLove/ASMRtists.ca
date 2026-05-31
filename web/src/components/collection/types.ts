export interface ArtworkPrintProduct {
  shopify_product_handle: string | null
  product_type: string
}

export interface CollectionArtwork {
  id: string
  position: number
  title: string
  description: string | null
  thumbnail_url: string | null
  jpeg_storage_path: string | null
  inscription_txid: string | null
  inscription_outpoint: string | null
  ordinal_metadata: Record<string, unknown> | null
  print_products: ArtworkPrintProduct[] | null
}

export interface CollectionArtist {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}

export interface CollectionData {
  id: string
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  status: string
  artwork: CollectionArtwork[]
  artist: CollectionArtist
}
