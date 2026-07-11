'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loader/spinner'
import { Download, Printer, Replace, Trash2 } from 'lucide-react'

type InvoicePreviewDialogPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReplace?: () => void
  onRemove?: () => void
  // next/image can't run the optimizer on a local blob: URL (not-yet-uploaded file) — serve it raw.
  unoptimized?: boolean
}

export function InvoicePreviewDialog({
  url,
  filename,
  mimeType,
  open,
  onOpenChange,
  onReplace,
  onRemove,
  unoptimized,
}: InvoicePreviewDialogPropsT) {
  const isImage = mimeType?.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const displayName = filename ?? 'Faktura'
  const [isMediaLoading, setIsMediaLoading] = useState(true)

  function handlePrint() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const content = isImage
      ? `<img src="${url}" alt="${displayName}" style="max-width:100%;height:auto" onload="window.print();window.close()" />`
      : isPdf
        ? `<iframe src="${url}" style="width:100%;height:100vh;border:none" onload="window.print();window.close()"></iframe>`
        : ''

    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${displayName}</title></head><body style="margin:0">${content}</body></html>`,
    )
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full sm:max-w-4xl">
        <DialogHeader title={displayName} />

        <div className="relative flex h-[70vh] min-h-0 w-full flex-1 items-center justify-center">
          {(isImage || isPdf) && isMediaLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {isImage && (
            <div className="relative h-full w-full">
              <Image
                src={url}
                alt={displayName}
                fill
                sizes="(max-width:1200px) 90vw, 1000px"
                quality={50}
                unoptimized={unoptimized}
                className="object-contain"
                onLoad={() => setIsMediaLoading(false)}
                onError={() => setIsMediaLoading(false)}
              />
            </div>
          )}
          {isPdf && (
            <iframe
              src={url}
              title={displayName}
              className="h-[70vh] w-full rounded border-0"
              onLoad={() => setIsMediaLoading(false)}
            />
          )}
          {!isImage && !isPdf && (
            <p className="text-muted-foreground text-sm">
              Podgląd niedostępny dla tego typu pliku.
            </p>
          )}
        </div>

        <DialogFooter>
          {onRemove && (
            <Button variant="destructive" onClick={onRemove}>
              <Trash2 />
              Usuń
            </Button>
          )}
          {onReplace && (
            <Button variant="outline" onClick={onReplace}>
              <Replace />
              Zamień
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer />
            Drukuj
          </Button>
          <Button variant="outline" asChild>
            <a href={url} download={filename ?? ''} target="_blank" rel="noopener noreferrer">
              <Download />
              Pobierz
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
