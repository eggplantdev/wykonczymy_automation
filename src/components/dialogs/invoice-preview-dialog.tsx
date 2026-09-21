'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { ZoomablePreviewImage } from './zoomable-preview-image'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/loader/spinner'
import { useInvoiceZip } from '@/hooks/use-invoice-zip'
import { buildInvoiceArchiveName, dedupeFilename } from '@/lib/invoices/invoice-zip'
import { isImageMime, isPdfMime, isPreviewableMime } from '@/lib/media/mime'
import { splitExtension } from '@/lib/utils/append-short-id'
import { today } from '@/lib/utils/date'
import { ChevronLeft, ChevronRight, Download, Plus, Printer, Trash2 } from 'lucide-react'
import { INVOICE_PREVIEW_LABELS } from '@/components/media/preview-labels'
import type { InvoiceFileT } from '@/types/transfers'
import type { PreviewLabelsT } from '@/types/media'

type InvoicePreviewDialogPropsT = {
  invoices: InvoiceFileT[]
  initialIndex?: number
  labels?: PreviewLabelsT
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd?: () => void
  onRemove?: (invoice: InvoiceFileT) => void
  onRemoveAll?: () => void
  // next/image can't run the optimizer on a local blob: URL (not-yet-uploaded file) — serve it raw.
  unoptimized?: boolean
}

export function InvoicePreviewDialog({
  invoices,
  initialIndex = 0,
  labels = INVOICE_PREVIEW_LABELS,
  open,
  onOpenChange,
  onAdd,
  onRemove,
  onRemoveAll,
  unoptimized,
}: InvoicePreviewDialogPropsT) {
  // Removing the last page must not leave the pager pointing past the end.
  const [pageIndex, setPageIndex] = useState(initialIndex)
  const [isMediaLoading, setIsMediaLoading] = useState(true)
  const { downloadFiles } = useInvoiceZip()

  const activeIndex = Math.min(pageIndex, Math.max(invoices.length - 1, 0))
  const active = invoices[activeIndex]
  const isMultiPage = invoices.length > 1
  const isImage = isImageMime(active?.mimeType)
  const isPdf = isPdfMime(active?.mimeType)
  const displayName = active?.filename ?? labels.fallbackTitle
  const title = isMultiPage ? `${displayName} (${activeIndex + 1}/${invoices.length})` : displayName

  function goToPage(index: number) {
    setPageIndex(index)
    setIsMediaLoading(true)
  }

  function handlePrint() {
    // Must open a blank window (about:blank inherits our origin + base URL), then build the
    // document with DOM APIs. Loading the window from a blob:/data: URL instead gives it an
    // opaque origin where the page URL — a relative Payload path OR a not-yet-uploaded blob:
    // preview — no longer resolves, so the media never loads and print never fires.
    const printable = invoices.filter((invoice) => isPreviewableMime(invoice.mimeType))
    if (printable.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const doc = printWindow.document
    doc.title = displayName
    doc.body.style.margin = '0'

    // One print job covers the whole document, so it fires only once every page has loaded —
    // printing on the first `load` would emit a one-page job with the rest still blank.
    let pending = printable.length
    const onPageReady = () => {
      pending--
      if (pending > 0) return
      printWindow.print()
      printWindow.close()
    }

    for (const invoice of printable) {
      let media: HTMLImageElement | HTMLIFrameElement
      if (isImageMime(invoice.mimeType)) {
        const img = doc.createElement('img')
        img.src = invoice.url
        img.alt = invoice.filename ?? displayName
        img.style.maxWidth = '100%'
        img.style.height = 'auto'
        media = img
      } else {
        const frame = doc.createElement('iframe')
        frame.src = invoice.url
        frame.style.width = '100%'
        frame.style.height = '100vh'
        frame.style.border = 'none'
        media = frame
      }

      media.addEventListener('load', onPageReady)
      media.addEventListener('error', onPageReady)
      doc.body.appendChild(media)
    }
  }

  function handleDownloadAll() {
    const usedNames = new Set<string>()
    downloadFiles(
      invoices.map((invoice, index) => ({
        url: invoice.url,
        name: dedupeFilename(invoice.filename ?? `strona-${index + 1}`, usedNames),
      })),
      buildInvoiceArchiveName([splitExtension(displayName).base], today(), labels.archivePrefix),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A rzut or a plan is worth only the pixels it is given, so this window takes the screen.
          Below `sm` the base DialogContent is already a full-bleed sheet — every override here has
          to beat the `sm:` half of it (`top-1/2 h-fit max-h-[90vh] -translate-y-1/2 rounded-lg`),
          which is why `sm:max-w-none` alone would not be enough. */}
      <DialogContent
        className="sm:top-0 sm:h-dvh sm:max-h-none sm:max-w-none sm:translate-y-0 sm:rounded-none"
        aria-describedby={undefined}
      >
        <DialogHeader title={title} />

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          {(isImage || isPdf) && isMediaLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Spinner />
            </div>
          )}
          {active && isImage && (
            // `key` is what resets the zoom: a remount per page drops scale, offset and the
            // original-source flag together, instead of three effects chasing `pageIndex`.
            <ZoomablePreviewImage
              key={active.url}
              src={active.url}
              alt={displayName}
              sizes="(max-width: 767.98px) calc(100vw - 2rem), calc(100vw - 3rem)"
              unoptimized={unoptimized}
              onLoad={() => setIsMediaLoading(false)}
              onError={() => setIsMediaLoading(false)}
            />
          )}
          {active && isPdf && (
            <iframe
              key={active.url}
              src={active.url}
              title={displayName}
              className="h-full w-full rounded border-0"
              onLoad={() => setIsMediaLoading(false)}
            />
          )}
          {active && !isImage && !isPdf && (
            <p className="text-muted-foreground text-sm">
              Podgląd niedostępny dla tego typu pliku.
            </p>
          )}
          {!active && <p className="text-muted-foreground text-sm">{labels.empty}</p>}
        </div>

        {isMultiPage && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={activeIndex === 0}
              onClick={() => goToPage(activeIndex - 1)}
              aria-label="Poprzednia strona"
            >
              <ChevronLeft />
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums">
              {activeIndex + 1} / {invoices.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={activeIndex === invoices.length - 1}
              onClick={() => goToPage(activeIndex + 1)}
              aria-label="Następna strona"
            >
              <ChevronRight />
            </Button>
          </div>
        )}

        <DialogFooter>
          {onRemove && active && (
            <Button variant="destructive" onClick={() => onRemove(active)}>
              <Trash2 />
              {isMultiPage ? labels.removeOneOfMany : labels.removeOne}
            </Button>
          )}
          {onRemoveAll && (
            <Button variant="destructive" onClick={onRemoveAll}>
              <Trash2 />
              {labels.removeAll}
            </Button>
          )}
          {onAdd && (
            <Button variant="outline" onClick={onAdd}>
              <Plus />
              {labels.add}
            </Button>
          )}
          {/* A single PDF renders in the browser's native viewer, which already has print + download
              in its toolbar. A multi-page set has no such toolbar for the set as a whole. */}
          {(!isPdf || isMultiPage) && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                <Printer />
                Drukuj
              </Button>
              {isMultiPage ? (
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Download />
                  Pobierz wszystkie
                </Button>
              ) : (
                active && (
                  <Button variant="outline" asChild>
                    <a
                      href={active.url}
                      download={active.filename ?? ''}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download />
                      Pobierz
                    </a>
                  </Button>
                )
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
