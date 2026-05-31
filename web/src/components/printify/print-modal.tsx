'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface PrintModalProps {
  printifyUrl: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrintModal({
  printifyUrl,
  title,
  open,
  onOpenChange,
}: PrintModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[95dvh] max-h-[95dvh] w-[95dvw] max-w-[95dvw] p-0 sm:max-w-4xl sm:h-[90dvh]">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-medium truncate">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 h-full min-h-0 overflow-hidden">
          <iframe
            src={printifyUrl}
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
