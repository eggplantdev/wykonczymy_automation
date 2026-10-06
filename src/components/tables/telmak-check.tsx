'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { Loader2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { useInvoiceUpload } from '@/hooks/use-invoice-upload'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { formatPLDate } from '@/lib/utils/format-date'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import type { TelmakStatusT } from '@/lib/telmak/compare-telmak'
import type { TelmakCheckRowT } from '@/lib/telmak/check-row'

const STATUS_LABELS: Record<TelmakStatusT, string> = {
  unreadable: 'Nieznany format',
  'missing-in-app': 'Brak w aplikacji',
  'app-only': 'Brak faktury w paczce',
  amount: 'Inna kwota',
  date: 'Inna data',
  cancelled: 'Anulowana',
  'other-register': 'Inna kasa',
  'no-file': 'Brak PDF w aplikacji',
  ok: 'Zgodne',
}

const col = createColumnHelper<TelmakCheckRowT>()

export function getTelmakCheckColumns(onAttached: () => void) {
  return [
    col.display({
      id: 'ids',
      header: 'ID w aplikacji',
      cell: ({ row }) =>
        row.original.rows.map((r) => (
          <span key={r.id} className={cn('mr-2', r.cancelled && 'line-through')}>
            #{r.id}
          </span>
        )),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={cn('font-medium', info.getValue() !== 'ok' && 'text-destructive')}>
          {STATUS_LABELS[info.getValue()]}
        </span>
      ),
    }),
    col.accessor('document', {
      header: 'Dokument',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
    }),
    col.accessor('issueDate', {
      header: 'Data wyst.',
      cell: (info) => (info.getValue() ? formatPLDate(info.getValue()!) : '—'),
    }),
    col.accessor('docAmount', {
      header: 'Faktura',
      meta: { align: 'right' },
      cell: (info) => formatPLNOrDash(info.getValue()),
    }),
    col.accessor('appAmount', {
      header: 'Aplikacja',
      meta: { align: 'right' },
      cell: (info) => formatPLNOrDash(info.getValue()),
    }),
    col.accessor('investmentName', {
      header: 'Inwestycja',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('notes', { header: 'Uwagi', meta: { minWidth: 'min-w-64' } }),
    col.display({
      id: 'preview',
      header: 'Podgląd',
      meta: { align: 'center' },
      cell: ({ row }) =>
        row.original.local && (
          <MediaPreviewButton
            labels={INVOICE_PREVIEW_LABELS}
            files={[row.original.local.preview]}
            label="Faktura z paczki"
            variant="compact"
          />
        ),
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const { local, needsFile } = row.original
        if (!local) return null
        return (
          <div className="flex items-center justify-end gap-2">
            {needsFile.map((r) => (
              <AttachButton
                key={r.id}
                transactionId={r.id}
                file={local.file}
                onAttached={onAttached}
              />
            ))}
          </div>
        )
      },
    }),
  ]
}

type AttachButtonPropsT = {
  transactionId: number
  file: File
  onAttached: () => void
}

function AttachButton({ transactionId, file, onAttached }: AttachButtonPropsT) {
  const { isUploading, uploadFiles } = useInvoiceUpload(transactionId)
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isUploading}
      onClick={async () => {
        if (await uploadFiles([file])) onAttached()
      }}
    >
      {isUploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
      Dołącz do #{transactionId}
    </Button>
  )
}
