'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialogShell } from '@/components/ui/form-dialog-shell'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { useFileArchive } from '@/hooks/use-file-archive'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { useTranslation } from '@/hooks/use-translation'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { flattenArchiveRows } from '@/lib/media/file-archive'
import { INVOICE_ARCHIVE_COPY } from '@/lib/media/wording'
import { failureMessage } from '@/lib/i18n/failure-message'
import { ALL_TIME, isClosedRange, urlDateRange, type DateRangeT } from '@/lib/utils/date-range'
import type { TransferRowsFetchT } from '@/components/transfers/transfer-table-config'
import type { TransferRowT } from '@/types/transfers'

type InvoiceDownloadDialogPropsT = {
  fetchRows: TransferRowsFetchT
}

// The rows that produce the count are the rows „Pobierz" packs — one fetch, so the number shown can
// never disagree with the archive.
export function InvoiceDownloadDialog({ fetchRows }: InvoiceDownloadDialogPropsT) {
  const { locale, t } = useTranslation('transfers')
  const searchParams = useSearchParams()
  const { download, isPending: isZipping } = useFileArchive()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRangeT>(ALL_TIME)
  const [rows, setRows] = useState<TransferRowT[]>()
  // Explicit state, not useTransition: a transition's pending flag would outlive `disown()` on close
  // and show a stale spinner on a quick reopen.
  const [isCounting, setIsCounting] = useState(false)
  const request = useLatestRequest()

  const isComplete = Boolean(range.from && range.to)
  const isInverted = isComplete && !isClosedRange(range)
  const fileCount = rows ? flattenArchiveRows(rows).length : 0

  async function count(next: DateRangeT) {
    const isLatest = request.start()
    setRows(undefined)
    if (!isClosedRange(next)) {
      setIsCounting(false)
      return
    }

    setIsCounting(true)
    const result = await settleAction(() => fetchRows({ range: next }))
    if (!isLatest()) return
    setIsCounting(false)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    setRows(result.data)
  }

  function changeRange(next: DateRangeT) {
    setRange(next)
    void count(next)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      request.disown()
      setRange(ALL_TIME)
      setRows(undefined)
      setIsCounting(false)
      return
    }

    const tableRange = urlDateRange(searchParams)
    if (tableRange.from && tableRange.to) changeRange(tableRange)
  }

  function handleDownload() {
    if (!rows || !isClosedRange(range)) return
    download(rows, [range.from, range.to], INVOICE_ARCHIVE_COPY)
    handleOpenChange(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        disabled={isZipping}
        aria-label={t('invoicesAria')}
      >
        {isZipping ? <Loader2 className="animate-spin" /> : <FileArchive />}
        {t('invoices')}
      </Button>
      <FormDialogShell
        open={open}
        onOpenChange={handleOpenChange}
        title={t('invoicesAria')}
        confirmLabel={t('invoicesDownload')}
        onConfirm={handleDownload}
        confirmDisabled={!rows || fileCount === 0}
        pending={isZipping}
        contentClassName="sm:max-w-dialog gap-6"
      >
        <DateRangePicker value={range} onChange={changeRange} stacked />

        <p className="text-sm" aria-live="polite">
          {!isComplete && <span className="text-muted-foreground">{t('invoicesPickRange')}</span>}
          {isInverted && <span className="text-destructive">{t('invoicesInvalidRange')}</span>}
          {isCounting && (
            <span className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {t('invoicesCounting')}
            </span>
          )}
          {rows && t('invoicesCount', { count: fileCount })}
        </p>
      </FormDialogShell>
    </>
  )
}
