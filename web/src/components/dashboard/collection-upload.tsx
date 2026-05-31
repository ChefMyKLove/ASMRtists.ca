'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, ImageIcon, X, CheckCircle, AlertCircle } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'

interface UploadedFile {
  id: string
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface CollectionUploadProps {
  onUploadComplete?: (fileIds: string[]) => void
  maxFiles?: number
}

const ACCEPTED_TYPES = { 'image/png': ['.png'] }
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const MIN_DPI = 300

export function CollectionUpload({
  onUploadComplete,
  maxFiles = 10,
}: CollectionUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.slice(0, maxFiles - files.length).map(
        (file): UploadedFile => ({
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(file),
          status: 'pending',
        })
      )
      setFiles((prev) => [...prev, ...newFiles])
    },
    [files.length, maxFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles,
  })

  function removeFile(id: string) {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file) URL.revokeObjectURL(file.preview)
      return prev.filter((f) => f.id !== id)
    })
  }

  async function handleUpload() {
    // TODO: POST each file to /api/collections/upload with server-side PNG validation
    // Server validates: PNG format, min 300 DPI, max 100MB
    const successIds = files
      .filter((f) => f.status === 'success')
      .map((f) => f.id)
    onUploadComplete?.(successIds)
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Upload Artwork
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Requirements callout */}
        <div className="text-xs text-muted-foreground space-y-0.5 p-3 rounded-lg bg-white/5">
          <p className="font-medium text-white/70 mb-1">Requirements</p>
          <p>Format: PNG only</p>
          <p>Minimum resolution: {MIN_DPI} DPI</p>
          <p>Maximum file size: {formatFileSize(MAX_FILE_SIZE)}</p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-white/40 bg-white/10'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          )}
        >
          <input {...getInputProps()} />
          <ImageIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          {isDragActive ? (
            <p className="text-sm">Drop your PNG files here</p>
          ) : (
            <>
              <p className="text-sm font-medium">Drop PNG files or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Up to {maxFiles} files, {formatFileSize(MAX_FILE_SIZE)} each
              </p>
            </>
          )}
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="h-10 w-10 rounded object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(f.file.size)}
                  </p>
                </div>
                {f.status === 'success' && (
                  <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                )}
                {f.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                )}
                {f.status === 'pending' && (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="text-muted-foreground hover:text-white transition-colors flex-shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {files.some((f) => f.status === 'pending') && (
          <Button onClick={handleUpload} className="w-full">
            Upload {files.filter((f) => f.status === 'pending').length} file
            {files.filter((f) => f.status === 'pending').length !== 1 ? 's' : ''}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
