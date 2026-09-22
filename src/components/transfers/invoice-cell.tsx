'use client'

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { MediaUploadDialog } from '@/components/dialogs/media-upload-dialog'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
import { useInvoiceUpload } from '@/hooks/use-invoice-upload'
import type { PreviewFileT } from '@/types/media'

type InvoiceCellPropsT = {
  transactionId: number
  invoices: PreviewFileT[]
}

export function InvoiceCell({ transactionId, invoices }: InvoiceCellPropsT) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useInvoiceUpload(transactionId)
  const { visibleInvoices, handleRemove, handleRemoveAll, removalConfirm } = useInvoiceRemoval(
    transactionId,
    invoices,
  )

  return (
    <>
      {isUploading ? (
        <Button
          variant="ghost"
          size="icon"
          disabled
          className="text-muted-foreground"
          aria-label="Przesyłanie faktury"
        >
          <Loader2 className="animate-spin" />
        </Button>
      ) : visibleInvoices.length > 0 ? (
        <MediaPreviewButton
          labels={INVOICE_PREVIEW_LABELS}
          files={visibleInvoices}
          variant="compact"
          // The preview would sit on top of the upload dialog, so it steps aside before it opens.
          onAdd={(closePreview) => {
            closePreview()
            setUploadOpen(true)
          }}
          onRemove={handleRemove}
          onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setUploadOpen(true)}
          className="text-muted-foreground"
          aria-label="Dodaj fakturę"
        >
          <Plus />
        </Button>
      )}

      <MediaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFiles={(picked) => void uploadFiles(picked)}
      />

      <ConfirmDialog {...removalConfirm} />
    </>
  )
}
