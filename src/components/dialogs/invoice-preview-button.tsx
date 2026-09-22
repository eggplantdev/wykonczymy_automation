'use client'

import { useState } from 'react'
import {
  InvoicePreviewDialog,
  type InvoicePreviewDialogPropsT,
} from '@/components/dialogs/invoice-preview-dialog'
import {
  InvoicePreviewTrigger,
  type InvoicePreviewTriggerPropsT,
} from '@/components/dialogs/invoice-preview-trigger'
import type { InvoiceFileT } from '@/types/transfers'
import type { PreviewLabelsT } from '@/types/media'

type InvoicePreviewButtonPropsT = {
  invoices: InvoiceFileT[]
  label?: string
  labels?: PreviewLabelsT
  // The open state lives here, so a caller that needs the preview gone (to make room for an upload
  // modal) gets `closePreview` rather than having it forced — a caller may want it to stay open
  // behind a `confirm()`, after a failed delete, or while the previewed file swaps in place.
  onAdd?: (closePreview: () => void) => void
  onRemove?: (invoice: InvoiceFileT, closePreview: () => void) => void
  onRemoveAll?: (closePreview: () => void) => void
  planMarker?: InvoicePreviewDialogPropsT['planMarker']
} & Pick<InvoicePreviewTriggerPropsT, 'ariaLabel' | 'variant' | 'className'>

export function InvoicePreviewButton({
  invoices,
  label,
  labels,
  onAdd,
  onRemove,
  onRemoveAll,
  planMarker,
  ariaLabel,
  variant,
  className,
}: InvoicePreviewButtonPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const closePreview = () => setPreviewOpen(false)

  return (
    <>
      <InvoicePreviewTrigger
        label={label ?? invoices[0]?.filename ?? 'Faktura'}
        ariaLabel={ariaLabel}
        onClick={() => setPreviewOpen(true)}
        variant={variant}
        className={className}
      />

      {previewOpen && (
        <InvoicePreviewDialog
          invoices={invoices}
          labels={labels}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onAdd={onAdd && (() => onAdd(closePreview))}
          onRemove={onRemove && ((invoice) => onRemove(invoice, closePreview))}
          onRemoveAll={onRemoveAll && (() => onRemoveAll(closePreview))}
          planMarker={planMarker}
          // Stored file is already ingest-compressed to one of the upload profiles — skip the Next
          // optimizer and its cold-start round-trip; serve straight from the Blob CDN.
          unoptimized
        />
      )}
    </>
  )
}
