'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { removeTransferInvoiceAction } from '@/lib/actions/transfers'

const InvoicePreviewDialog = dynamic(() =>
  import('@/components/dialogs/invoice-preview-dialog').then((m) => ({
    default: m.InvoicePreviewDialog,
  })),
)

const InvoiceUploadDialog = dynamic(() =>
  import('@/components/dialogs/invoice-upload-dialog').then((m) => ({
    default: m.InvoiceUploadDialog,
  })),
)

type InvoiceCellPropsT = {
  readonly transactionId: number
  readonly url: string | null
  readonly filename: string | null
  readonly mimeType: string | null
}

export function InvoiceCell({ transactionId, url, filename, mimeType }: InvoiceCellPropsT) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const hasInvoice = !!url

  const router = useRouter()

  function handleReplace() {
    setPreviewOpen(false)
    setUploadOpen(true)
  }

  async function handleRemove() {
    if (!confirm('Czy na pewno chcesz usunąć fakturę?')) return
    setPreviewOpen(false)
    const result = await removeTransferInvoiceAction(transactionId)
    if (result.success) router.refresh()
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
