'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Opens ASMRprints.com product in an iframe modal
// URL format: https://asmrprints.com/product/{handle}?embed=1

interface ShopModalProps {
  shopifyUrl: string
  title: string
  isOpen: boolean
  onClose: () => void
}

export function ShopModal({ shopifyUrl, title, isOpen, onClose }: ShopModalProps) {
  const [iframeError, setIframeError] = useState(false)

  function handleOpen(open: boolean) {
    if (!open) {
      onClose()
      setIframeError(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="h-[95dvh] max-h-[95dvh] w-[95dvw] max-w-[95dvw] p-0 sm:max-w-4xl sm:h-[90dvh]">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-sm font-medium truncate">{title}</DialogTitle>
          <a
            href={shopifyUrl.replace('?embed=1', '')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors ml-4 flex-shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in new tab
          </a>
        </DialogHeader>
        {iframeError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">Unable to load the print shop here.</p>
            <a
              href={shopifyUrl.replace('?embed=1', '')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open ASMRprints.com
            </a>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            <iframe
              src={shopifyUrl}
              title={title}
              className="w-full h-full border-0"
              allow="payment"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
              onError={() => setIframeError(true)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
