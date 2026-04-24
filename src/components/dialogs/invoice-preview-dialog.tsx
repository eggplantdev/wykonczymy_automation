'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Printer, Replace, Trash2 } from 'lucide-react'
import { ImageMedia } from '../ImageMedia'

type InvoicePreviewDialogPropsT = {
  url: string
  filename: string | null
  mimeType: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReplace?: () => void
  onRemove?: () => void
}

export function InvoicePreviewDialog({
  url,
  filename,
  mimeType,
  open,
  onOpenChange,
  onReplace,
  onRemove,
}: InvoicePreviewDialogPropsT) {
  const isImage = mimeType?.startsWith('image/')
  const isPdf = mimeType === 'application/pdf'
  const displayName = filename ?? 'Faktura'

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

        <div className="flex h-[70vh] min-h-0 w-full flex-1 items-center justify-center">
          {isImage && (
            <ImageMedia
              containerClass="relative h-full"
              imgClass="object-contain"
              sizes="(max-width:1200px) 90vw, 1000px"
              src={url}
              alt={displayName}
              fill
              quality={50}
            />
          )}
          {isPdf && (
            <iframe src={url} title={displayName} className="h-[70vh] w-full rounded border-0" />
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
