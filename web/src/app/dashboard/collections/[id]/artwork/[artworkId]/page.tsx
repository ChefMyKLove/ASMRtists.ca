import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateArtworkMetadataAction } from '@/app/actions/collections'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit Artwork — Dashboard' }

interface PageProps {
  params: Promise<{ id: string; artworkId: string }>
}

function getStorageUrl(path: string | null): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/artwork-originals/${path}`
}

export default async function ArtworkEditPage({ params }: PageProps) {
  const { id, artworkId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createAdminClient()

  const { data: ap } = await admin
    .from('artist_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!ap) notFound()

  const { data: art } = await admin
    .from('artwork')
    .select('id, title, subtitle, position, storage_path, inscription_txid, status')
    .eq('id', artworkId)
    .eq('artist_id', ap.id)
    .single()
  if (!art) notFound()

  async function handleSave(formData: FormData) {
    'use server'
    const title = (formData.get('title') as string)?.trim()
    const subtitle = (formData.get('subtitle') as string)?.trim() || null
    const txid = (formData.get('inscription_txid') as string)?.trim() || null

    if (!title) return

    const { error } = await updateArtworkMetadataAction(artworkId, title, subtitle, txid)
    if (!error) redirect(`/dashboard/collections/${id}`)
  }

  const imgUrl = getStorageUrl(art.storage_path)

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/collections/${id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5')}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-bold">Edit Piece #{art.position}</h1>
      </div>

      {imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgUrl} alt={art.title} className="w-full max-h-64 object-contain rounded-xl glass" />
      )}

      <form action={handleSave} className="glass rounded-xl p-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={art.title}
            required
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle <span className="text-white/40 font-normal">(optional)</span></Label>
          <Input
            id="subtitle"
            name="subtitle"
            defaultValue={art.subtitle ?? ''}
            placeholder="e.g. Limited edition 1 of 64"
            className="bg-white/5 border-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inscription_txid">
            Inscription TxID <span className="text-white/40 font-normal">(optional — set when ordinal is minted)</span>
          </Label>
          <Input
            id="inscription_txid"
            name="inscription_txid"
            defaultValue={art.inscription_txid ?? ''}
            placeholder="BSV transaction ID of the ordinal inscription"
            className="bg-white/5 border-white/10 font-mono text-xs"
          />
        </div>

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>
    </div>
  )
}
