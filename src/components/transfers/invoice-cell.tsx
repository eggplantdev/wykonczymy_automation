'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InvoicePreviewDialog } from '@/components/dialogs/invoice-preview-dialog'
import { removeTransferInvoiceAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/lib/utils/toast'

const InvoiceUploadDialog = dynamic(() =>
  import('@/components/dialogs/invoice-upload-dialog').then((m) => ({
    default: m.InvoiceUploadDialog,
  })),
)

type InvoiceCellPropsT = {
  transactionId: number
  url: string | null
  filename: string | null
  mimeType: string | null
}

export function InvoiceCell({ transactionId, url, filename, mimeType }: InvoiceCellPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [removed, setRemoved] = useState(false)

  const hasInvoice = !!url && !removed

  function handleReplace() {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  async function handleRemove() {
    if (!confirm('Czy na pewno chcesz usunąć fakturę?')) return
    const result = await removeTransferInvoiceAction(transactionId)
    if (result.success) {
      setPreviewOpen(false)
      setRemoved(true)
    } else {
      toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
    }
  }

  return (
    <>
      {hasInvoice ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPreviewOpen(true)}
          className="text-muted-foreground"
          aria-label={`Podgląd faktury: ${filename ?? 'faktura'}`}
        >
          <FileText />
        </Button>
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

      {url && previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={filename}
          mimeType={mimeType}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onReplace={handleReplace}
          onRemove={handleRemove}
        />
      )}

      {uploadOpen && (
        <InvoiceUploadDialog
          transactionId={transactionId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          isReplace={hasInvoice}
        />
      )}
    </>
  )
}
