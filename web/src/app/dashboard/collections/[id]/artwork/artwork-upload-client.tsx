'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { insertArtworkAction, updateCollectionPieceCountAction } from '@/app/actions/collections'
import { Button } from '@/components/ui/button'
import { cn, formatFileSize } from '@/lib/utils'
import {
  Upload,
  ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'

const ACCEPTED_TYPES = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MIN_PX = 3000

type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

interface UploadFile {
  id: string
  file: File
  preview: string
  status: FileStatus
  error?: string
  width?: number
  height?: number
  lowResWarning?: boolean
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url) }
    img.src = url
  })
}

function filenameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function ProgressBar({ uploaded, total }: { uploaded: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((uploaded / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-white/60">
        <span>{uploaded} / {total} files uploaded</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  collectionId: string
  collectionTitle: string
  artistProfileId: string
  userId: string
  currentPieceCount: number
}

export function ArtworkUploadClient({ collectionId, collectionTitle, artistProfileId, userId, currentPieceCount }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'select' | 'uploading' | 'done'>('select')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploaded, setUploaded] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const maxNewFiles = 64 - currentPieceCount

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const remaining = maxNewFiles - files.length
    const incoming = acceptedFiles.slice(0, remaining)
    const newFiles = await Promise.all(
      incoming.map(async (file): Promise<UploadFile> => {
        const preview = URL.createObjectURL(file)
        const { width, height } = await getImageDimensions(file)
        return {
          id: crypto.randomUUID(),
          file,
          preview,
          status: 'pending',
          width,
          height,
          lowResWarning: width > 0 && Math.min(width, height) < MIN_PX,
        }
      })
    )
    setFiles((prev) => [...prev, ...newFiles])
  }, [files.length, maxNewFiles])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
  })

  function removeFile(id: string) {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id)
      if (f) URL.revokeObjectURL(f.preview)
      return prev.filter((x) => x.id !== id)
    })
  }

  async function handleUpload() {
    setStep('uploading')
    setUploaded(0)
    setErrors([])

    let count = 0
    const errs: string[] = []

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const position = currentPieceCount + i + 1
      const storagePath = `${userId}/${collectionId}/${position}_${f.file.name}`

      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'uploading' } : x)))

      const { error: storageErr } = await supabase.storage
        .from('artwork-originals')
        .upload(storagePath, f.file, { upsert: false })

      if (storageErr) {
        errs.push(`${f.file.name}: ${storageErr.message}`)
        setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'error', error: storageErr.message } : x)))
      } else {
        const { error: artErr } = await insertArtworkAction(
          collectionId,
          artistProfileId,
          filenameWithoutExt(f.file.name),
          storagePath,
          f.width ?? null,
          f.height ?? null,
        )
        if (artErr) {
          errs.push(`${f.file.name}: ${artErr}`)
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'error', error: artErr } : x)))
        } else {
          count++
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'success' } : x)))
        }
      }
      setUploaded(count)
      setErrors([...errs])
    }

    if (count > 0) {
      await updateCollectionPieceCountAction(collectionId, currentPieceCount + count)
    }

    setStep('done')
  }

  if (step === 'uploading') {
    return (
      <div className="glass rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-sm">Uploading…</h2>
        <ProgressBar uploaded={uploaded} total={files.length} />
        {errors.length > 0 && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-red-400">Some files failed:</p>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 flex items-start gap-1.5 font-mono break-all">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {e}
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-white/40">Please keep this tab open.</p>
      </div>
    )
  }

  if (step === 'done') {
    const allFailed = uploaded === 0 && errors.length > 0
    return (
      <div className="glass rounded-xl p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center mx-auto ${allFailed ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
            {allFailed ? <AlertCircle className="h-6 w-6 text-red-400" /> : <Sparkles className="h-6 w-6 text-emerald-400" />}
          </div>
          <h2 className="font-semibold text-lg">
            {allFailed ? 'Upload failed' : `${uploaded} piece${uploaded !== 1 ? 's' : ''} added!`}
          </h2>
          {!allFailed && (
            <p className="text-sm text-muted-foreground">
              Added to <span className="text-white font-medium">{collectionTitle}</span>.
            </p>
          )}
        </div>
        {errors.length > 0 && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-red-400">{errors.length} file{errors.length !== 1 ? 's' : ''} failed:</p>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 flex items-start gap-1.5 font-mono break-all">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-400" />
                {e}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => { setStep('select'); setFiles([]); setUploaded(0); setErrors([]) }} className="flex-1">
            {allFailed ? 'Try Again' : 'Add More'}
          </Button>
          {!allFailed && (
            <Button onClick={() => router.push(`/dashboard/collections/${collectionId}`)} className="flex-1">
              View Collection
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Add Artwork</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Adding to <span className="text-white">{collectionTitle}</span> · {currentPieceCount}/64 pieces
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/collections/${collectionId}`)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="glass rounded-xl p-6 space-y-5">
        <div className="text-xs text-white/50 space-y-0.5 p-3 rounded-lg bg-white/5">
          <p className="font-medium text-white/60 mb-1">File requirements</p>
          <p>Formats: PNG or JPEG · Max {formatFileSize(MAX_FILE_SIZE)} per file · Up to {maxNewFiles} more files</p>
          <p className="text-amber-400/70">Files below {MIN_PX.toLocaleString()}px on the short side may not print at full quality.</p>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive ? 'border-violet-400/50 bg-violet-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          )}
        >
          <input {...getInputProps()} />
          <ImageIcon className="h-8 w-8 mx-auto mb-3 text-white/20" />
          {isDragActive ? (
            <p className="text-sm text-white/60">Drop files here…</p>
          ) : (
            <>
              <p className="text-sm font-medium">Drop PNG or JPEG files, or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Up to {maxNewFiles} files · {formatFileSize(MAX_FILE_SIZE)} each</p>
            </>
          )}
        </div>

        {fileRejections.length > 0 && (
          <div className="space-y-1">
            {fileRejections.map(({ file, errors: errs }) => (
              <p key={file.name} className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {file.name}: {errs.map((e) => e.message).join(', ')}
              </p>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {files.map((f, i) => (
              <div key={f.id} className="relative group flex flex-col gap-1.5">
                <div className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.preview} alt={f.file.name} className="w-full h-full object-cover" />
                  <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    #{currentPieceCount + i + 1}
                  </span>
                  <div className="absolute top-1 right-1">
                    {f.status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                    {f.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                    {f.status === 'uploading' && <Clock className="h-4 w-4 text-amber-400 animate-pulse" />}
                  </div>
                  {f.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Remove file"
                    >
                      <X className="h-5 w-5 text-white" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] truncate text-white/70 px-0.5">{f.file.name}</p>
                {f.lowResWarning && <p className="text-[10px] text-amber-400 px-0.5">Low resolution</p>}
                {f.error && <p className="text-[10px] text-red-400 px-0.5">{f.error}</p>}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-white/40">{files.length} / {maxNewFiles} files added</p>

        <Button onClick={handleUpload} disabled={files.length === 0} className="w-full gap-1">
          <Upload className="h-4 w-4" />
          Upload {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'Artwork'}
        </Button>
      </div>
    </div>
  )
}
