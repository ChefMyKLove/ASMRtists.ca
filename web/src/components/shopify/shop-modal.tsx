'use client'

import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  giclee: 'Giclee Print',
  canvas: 'Canvas',
  poster: 'Poster',
  print: 'Print',
}

function productLabel(type: string) {
  return PRODUCT_TYPE_LABELS[type.toLowerCase()] ?? type
}

interface PrintProduct {
  handle: string
  productType: string
}

interface ShopModalProps {
  shopifyUrl: string
  title: string
  isOpen: boolean
  onClose: () => void
  printProducts?: PrintProduct[]
  onProductChange?: (handle: string) => void
}

export function ShopModal({ shopifyUrl, title, isOpen, onClose, printProducts, onProductChange }: ShopModalProps) {
  const [iframeError, setIframeError] = useState(false)

  function handleOpen(open: boolean) {
    if (!open) {
      onClose()
      setIframeError(false)
    }
  }

  function handleProductSwitch(product: PrintProduct) {
    setIframeError(false)
    onProductChange?.(product.handle)
  }

  const externalUrl = shopifyUrl.replace('?embed=1', '')
  const showSwitcher = (printProducts?.length ?? 0) > 1

  const activeHandle = shopifyUrl.match(/\/product\/([^?]+)/)?.[1] ?? ''

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      {/* absolute inset-0 child bypasses the base grid layout so flex-col fills the dialog height */}
      <DialogContent
        showCloseButton={false}
        className="h-[95dvh] max-h-[95dvh] w-[95dvw] max-w-[95dvw] p-0 sm:max-w-4xl sm:h-[90dvh] overflow-hidden"
      >
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/20">
            <span className="text-sm font-medium truncate pr-4">{title}</span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => handleOpen(false)}
                className="text-muted-foreground hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showSwitcher && (
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-border/20 bg-muted/30">
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground mr-2">Format:</span>
              {printProducts!.map((p) => (
                <button
                  key={p.handle}
                  type="button"
                  onClick={() => handleProductSwitch(p)}
                  className={`px-3 py-1 text-xs border transition-colors ${
                    activeHandle === p.handle
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                  }`}
                >
                  {productLabel(p.productType)}
                </button>
              ))}
            </div>
          )}

          {iframeError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">Unable to load the print shop here.</p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open in new tab
              </a>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
