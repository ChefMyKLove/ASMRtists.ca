'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  createCollectionAction,
  insertArtworkAction,
  finalizeCollectionAction,
} from '@/app/actions/collections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatFileSize } from '@/lib/utils'
import {
  Upload,
  ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Sparkles,
  Gem,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

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

interface UploadProgress {
  uploaded: number
  total: number
  errors: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'] }
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_FILES = 64
const MIN_PX = 3000 // proxy for high-DPI — can't check DPI client-side

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

function filenameWithoutExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

function sanitizeStorageName(name: string): string {
  // Replace spaces and special chars that break storage URLs; keep extension
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Details' },
    { n: 2, label: 'Artwork' },
    { n: 3, label: 'Processing' },
    { n: 4, label: 'Done' },
  ]
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={cn(
              'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
              n < current
                ? 'bg-emerald-500/30 text-emerald-300'
                : n === current
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/30'
            )}
          >
            {n < current ? <CheckCircle className="h-4 w-4" /> : n}
          </div>
          <span
            className={cn(
              'text-xs hidden sm:inline',
              n === current ? 'text-white font-medium' : 'text-white/40'
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <div className={cn('h-px w-6 mx-1', n < current ? 'bg-emerald-500/30' : 'bg-white/10')} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const newTags = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t))
    if (newTags.length) onChange([...tags, ...newTags])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
      setInput('')
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  function handleBlur() {
    if (input.trim()) {
      addTag(input)
      setInput('')
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-white/25 min-h-[40px]">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/80"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? 'Add tags, press Enter or comma…' : ''}
        className="bg-transparent outline-none text-xs flex-1 min-w-[120px] text-white placeholder:text-white/30"
      />
    </div>
  )
}

// ─── File preview card ────────────────────────────────────────────────────────

function FilePreviewCard({
  file,
  index,
  onRemove,
}: {
  file: UploadFile
  index: number
  onRemove: (id: string) => void
}) {
  return (
    <div className="relative group flex flex-col gap-1.5">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={file.preview} alt={file.file.name} className="w-full h-full object-cover" />

        {/* Position badge */}
        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          #{index + 1}
        </span>

        {/* Status indicator */}
        <div className="absolute top-1 right-1">
          {file.status === 'success' && <CheckCircle className="h-4 w-4 text-emerald-400" />}
          {file.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
          {file.status === 'uploading' && (
            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
          )}
        </div>

        {/* Remove button */}
        {file.status === 'pending' && (
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            aria-label="Remove file"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        )}

        {/* Drag handle overlay */}
        <div className="absolute bottom-1 left-1 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      </div>

      <div className="px-0.5">
        <p className="text-[10px] font-medium truncate text-white/70">{file.file.name}</p>
        <p className="text-[10px] text-white/40">{formatFileSize(file.file.size)}</p>
        {file.lowResWarning && (
          <p className="text-[10px] text-amber-400 mt-0.5">
            Low resolution — may not print at full quality
          </p>
        )}
        {file.error && (
          <p className="text-[10px] text-red-400 mt-0.5">{file.error}</p>
        )}
      </div>
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ uploaded, total }: { uploaded: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((uploaded / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-white/60">
        <span>
          {uploaded} / {total} files uploaded
        </span>
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

// ─── Main wizard page ─────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  // Wizard state
  const [step, setStep] = useState<Step>(1)

  // Step 1 fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [ordinalListingEnabled, setOrdinalListingEnabled] = useState(false)
  const [ordinalPriceMnee, setOrdinalPriceMnee] = useState('')

  // Step 2 files
  const [files, setFiles] = useState<UploadFile[]>([])

  // Step 3 progress
  const [progress, setProgress] = useState<UploadProgress>({ uploaded: 0, total: 0, errors: [] })
  const [collectionId, setCollectionId] = useState<string | null>(null)

  // ── Drop handler ────────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const remaining = MAX_FILES - files.length
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
    },
    [files.length]
  )

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

  // ── Upload handler ──────────────────────────────────────────────────────────

  async function handleUpload() {
    setStep(3)
    setProgress({ uploaded: 0, total: files.length, errors: [] })

    // 1. Create collection + resolve artist_profiles.id via server action
    const { collectionId: cid, artistProfileId, userId, error: collErr } =
      await createCollectionAction(title, description || null, tags)

    if (collErr || !cid || !artistProfileId || !userId) {
      setProgress((p) => ({ ...p, errors: [collErr ?? 'Failed to create collection'] }))
      return
    }
    setCollectionId(cid)

    // 2. Upload each file to Storage + insert artwork row
    const errors: string[] = []
    let uploaded = 0

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const storagePath = `${userId}/${cid}/${i + 1}_${sanitizeStorageName(f.file.name)}`

      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'uploading' } : x)))

      const { error: storageErr } = await supabase.storage
        .from('artwork-originals')
        .upload(storagePath, f.file, { upsert: true })

      if (storageErr) {
        errors.push(`${f.file.name}: ${storageErr.message}`)
        setFiles((prev) =>
          prev.map((x) => (x.id === f.id ? { ...x, status: 'error', error: storageErr.message } : x))
        )
      } else {
        const { error: artErr } = await insertArtworkAction(
          cid,
          artistProfileId,
          filenameWithoutExt(f.file.name),
          storagePath,
          f.width ?? null,
          f.height ?? null,
          ordinalListingEnabled && ordinalPriceMnee ? Number(ordinalPriceMnee) : null,
        )
        if (artErr) {
          errors.push(`${f.file.name}: ${artErr}`)
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'error', error: artErr } : x)))
        } else {
          uploaded++
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'success' } : x)))
        }
      }

      setProgress({ uploaded, total: files.length, errors })
    }

    // 3. Finalize collection
    if (uploaded > 0) {
      await finalizeCollectionAction(cid, uploaded)
    }

    setStep(4)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Collection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share your artwork — admin reviews, then prints ship worldwide.
        </p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Collection details ─────────────────────────────────────── */}
      {step === 1 && (
        <div className="glass rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-sm">Collection Details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium text-white/70">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midnight Frequencies"
              className="bg-white/5 border-white/10 focus:border-white/25"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium text-white/70">
              Description <span className="text-white/30">(optional)</span>
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell collectors about this collection…"
              rows={4}
              className="w-full rounded-lg bg-white/5 border border-white/10 focus:border-white/25 px-3 py-2 text-sm outline-none resize-none placeholder:text-white/30 text-white"
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-white/70">
              Tags <span className="text-white/30">(optional)</span>
            </Label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          {/* Ordinal listing toggle */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-white/70 flex items-center gap-2 cursor-pointer">
                <Gem className="h-3.5 w-3.5 text-amber-400" />
                Enable ordinal collector minting
              </Label>
              <button
                type="button"
                role="switch"
                aria-checked={ordinalListingEnabled ? 'true' : 'false'}
                title={ordinalListingEnabled ? 'Disable ordinal minting' : 'Enable ordinal minting'}
                onClick={() => setOrdinalListingEnabled((v) => !v)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  ordinalListingEnabled ? 'bg-amber-500' : 'bg-white/15'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform',
                    ordinalListingEnabled ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {ordinalListingEnabled && (
              <div className="space-y-1.5 pl-5">
                <Label htmlFor="ordinal-price" className="text-xs font-medium text-white/70">
                  Mint price (MNEE) <span className="text-white/30">(optional — leave blank for free)</span>
                </Label>
                <Input
                  id="ordinal-price"
                  type="number"
                  min="0"
                  step="1"
                  value={ordinalPriceMnee}
                  onChange={(e) => setOrdinalPriceMnee(e.target.value)}
                  placeholder="e.g. 10"
                  className="bg-white/5 border-white/10 focus:border-white/25 max-w-[160px]"
                />
                <p className="text-xs text-amber-400/70">
                  Collectors can mint each piece as a BSV ordinal for this price. Ordinals appear in the marketplace once your collection is approved.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className="gap-1"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload artwork ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="glass rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-sm">Upload Artwork</h2>

          {/* Requirements callout */}
          <div className="text-xs text-white/50 space-y-0.5 p-3 rounded-lg bg-white/5">
            <p className="font-medium text-white/60 mb-1">File requirements</p>
            <p>Formats: PNG or JPEG</p>
            <p>Max size: {formatFileSize(MAX_FILE_SIZE)} per file</p>
            <p>Up to {MAX_FILES} files per collection</p>
            <p className="text-amber-400/70">
              Note: DPI cannot be checked in-browser — ensure files are at least 300 DPI
              for print quality. Files below {MIN_PX.toLocaleString()}px on the short side will show a
              warning.
            </p>
          </div>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-violet-400/50 bg-violet-500/10'
                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            )}
          >
            <input {...getInputProps()} />
            <ImageIcon className="h-8 w-8 mx-auto mb-3 text-white/20" />
            {isDragActive ? (
              <p className="text-sm text-white/60">Drop files here…</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drop PNG or JPEG files, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Up to {MAX_FILES} files · {formatFileSize(MAX_FILE_SIZE)} each
                </p>
              </>
            )}
          </div>

          {/* Rejection errors */}
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

          {/* File grid */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {files.map((f, i) => (
                <FilePreviewCard key={f.id} file={f} index={i} onRemove={removeFile} />
              ))}
            </div>
          )}

          <p className="text-xs text-white/40">
            {files.length} / {MAX_FILES} files added
          </p>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleUpload}
              disabled={files.length === 0}
              className="gap-1"
            >
              <Upload className="h-4 w-4" />
              Upload Collection
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Processing ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="glass rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-sm">Uploading…</h2>
          <ProgressBar uploaded={progress.uploaded} total={progress.total} />

          {progress.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-400">Some files failed:</p>
              {progress.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400/80 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {e}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-white/40">Please keep this tab open.</p>
        </div>
      )}

      {/* ── Step 4: Submitted ──────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="glass rounded-xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
            <h2 className="font-semibold text-lg">Collection Submitted!</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-white">{title}</span> has been submitted for
              review.
            </p>
            {progress.errors.length > 0 && (
              <p className="text-xs text-amber-400">
                {progress.errors.length} file{progress.errors.length !== 1 ? 's' : ''} failed to
                upload.
              </p>
            )}
          </div>

          {/* What happens next */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">
              What happens next
            </h3>
            {[
              {
                n: 1,
                text: 'Admin/curator reviews your collection (typically 1–3 business days)',
              },
              {
                n: 2,
                text: 'Once approved, your prints are automatically listed on ASMRprints.com',
              },
              {
                n: 3,
                text: 'Your artwork is inscribed as a BSV ordinal on-chain',
              },
              {
                n: 4,
                text: 'You start earning from every print sale',
              },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-white/10 text-white/60 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {n}
                </span>
                <p className="text-sm text-white/70">{text}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {collectionId && (
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/collections/${collectionId}`)}
                className="flex-1"
              >
                View Collection
              </Button>
            )}
            <Button
              onClick={() => {
                setStep(1)
                setTitle('')
                setDescription('')
                setTags([])
                setFiles([])
                setCollectionId(null)
                setProgress({ uploaded: 0, total: 0, errors: [] })
              }}
              className="flex-1"
            >
              Upload Another Collection
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
