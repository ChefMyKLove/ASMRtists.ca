'use client'

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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="h-[95dvh] max-h-[95dvh] w-[95dvw] max-w-[95dvw] p-0 sm:max-w-4xl sm:h-[90dvh]">
        <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <DialogTitle className="text-sm font-medium truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <iframe
            src={shopifyUrl}
            title={title}
            className="w-full h-full border-0"
            allow="payment"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
