import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCollectionForUploadAction } from '@/app/actions/collections'
import { ArtworkUploadClient } from './artwork-upload-client'

export const metadata: Metadata = { title: 'Add Artwork — Dashboard' }

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ArtworkUploadPage({ params }: PageProps) {
  const { id } = await params
  const { title, artistProfileId, userId, pieceCount, error } = await getCollectionForUploadAction(id)

  if (error || !title || !artistProfileId || !userId) {
    redirect('/dashboard/collections')
  }

  return (
    <div className="max-w-2xl">
      <ArtworkUploadClient
        collectionId={id}
        collectionTitle={title}
        artistProfileId={artistProfileId}
        userId={userId}
        currentPieceCount={pieceCount}
      />
    </div>
  )
}
