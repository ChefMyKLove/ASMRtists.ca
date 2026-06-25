import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as a currency string */
export function formatCurrency(
  amount: number,
  currency = 'CAD',
  locale = 'en-CA'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

/** Truncate a BSV address for display: "1ABC...XYZ9" */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

/** Slugify a string for URL use */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Convert bytes to a human-readable file size */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Build a public Supabase storage URL for artwork-originals.
 * Accepts either a full https URL (returned as-is) or a relative storage path.
 * Each path segment is percent-encoded so filenames with spaces, #, etc. work.
 */
export function artworkStorageUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const encoded = pathOrUrl.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/artwork-originals/${encoded}`
}
