'use client'

import { useState } from 'react'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import {
  InvoicePreviewTrigger,
  type InvoicePreviewTriggerPropsT,
} from '@/components/dialogs/invoice-preview-trigger'
import type { InvoiceFileT } from '@/types/transfers'

type InvoicePreviewButtonPropsT = {
  invoices: InvoiceFileT[]
  // The open state lives here, so a caller that needs the preview gone (to make room for an upload
  // modal) gets `closePreview` rather than having it forced — a caller may want it to stay open
  // behind a `confirm()`, after a failed delete, or while the previewed file swaps in place.
  onAdd?: (closePreview: () => void) => void
  onRemove?: (invoice: InvoiceFileT, closePreview: () => void) => void
  onRemoveAll?: (closePreview: () => void) => void
} & Pick<InvoicePreviewTriggerPropsT, 'variant' | 'className'>

export function InvoicePreviewButton({
  invoices,
  onAdd,
  onRemove,
  onRemoveAll,
  variant,
  className,
}: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const closePreview = () => setPreviewOpen(false)

  return (
    <>
      <InvoicePreviewTrigger
        label={invoices[0]?.filename ?? 'Faktura'}
        onClick={() => setPreviewOpen(true)}
        variant={variant}
        className={className}
      />

      {previewOpen && (
        <InvoicePreviewDialog
          invoices={invoices}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onAdd={onAdd && (() => onAdd(closePreview))}
          onRemove={onRemove && ((invoice) => onRemove(invoice, closePreview))}
          onRemoveAll={onRemoveAll && (() => onRemoveAll(closePreview))}
          // Stored file is already ingest-compressed (≤1920px, q0.6) — skip the Next optimizer
          // and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
