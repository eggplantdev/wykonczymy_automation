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
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import type { PreviewFileT } from '@/types/media'
import { useTranslation } from '@/hooks/use-translation'
import { useRowActionLabels } from '@/components/ui/row-actions/row-action-labels'

type InvoiceCellPropsT = {
  transactionId: number
  invoices: PreviewFileT[]
}

export function InvoiceCell({ transactionId, invoices }: InvoiceCellPropsT) {
  const { t } = useTranslation('transfers')
  const { role } = useCurrentUser()
  const isLabelled = useRowActionLabels()
  const previewVariant = isLabelled ? 'chip' : 'compact'
  const previewLabel = isLabelled ? t('invoiceShort') : undefined
  const iconButtonProps = isLabelled
    ? ({ variant: 'outline', size: 'xs' } as const)
    : ({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground' } as const)
  const [uploadOpen, setUploadOpen] = useState(false)
  const { isUploading, uploadFiles } = useInvoiceUpload(transactionId)
  const { visibleInvoices, handleRemove, handleRemoveAll, removalConfirm } = useInvoiceRemoval(
    transactionId,
    invoices,
  )

  // The worker sees his own transfers' faktury, but the upload and removal actions refuse him.
  if (!isManagementRole(role)) {
    return invoices.length > 0 ? (
      <MediaPreviewButton
        labels={INVOICE_PREVIEW_LABELS}
        files={invoices}
        variant={previewVariant}
        label={previewLabel}
      />
    ) : null
  }

  return (
    <>
      {isUploading ? (
        <Button {...iconButtonProps} disabled aria-label={t('invoiceUploading')}>
          <Loader2 className="animate-spin" />
          {isLabelled && t('invoiceShort')}
        </Button>
      ) : visibleInvoices.length > 0 ? (
        <MediaPreviewButton
          labels={INVOICE_PREVIEW_LABELS}
          files={visibleInvoices}
          variant={previewVariant}
          label={previewLabel}
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
          {...iconButtonProps}
          onClick={() => setUploadOpen(true)}
          aria-label={t('invoiceAdd')}
        >
          <Plus />
          {isLabelled && t('invoiceShort')}
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
