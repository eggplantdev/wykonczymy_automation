'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { useFileArchive } from '@/hooks/use-file-archive'
import { useLatestRequest } from '@/hooks/use-latest-request'
import { useTranslation } from '@/hooks/use-translation'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { flattenArchiveRows } from '@/lib/media/file-archive'
import { INVOICE_ARCHIVE_COPY } from '@/lib/media/wording'
import { failureMessage } from '@/lib/i18n/failure-message'
import { ALL_TIME, dayBound, type DateRangeT } from '@/lib/utils/date-range'
import type { TransferRowsFetchT } from '@/components/transfers/transfer-table-config'
import type { TransferRowT } from '@/types/transfers'

type InvoiceDownloadDialogPropsT = {
  fetchRows: TransferRowsFetchT
}

// The rows that produce the count are the rows „Pobierz" packs — one fetch, so the number shown can
// never disagree with the archive. Packing belongs to `useFileArchive`, shared with the kosztorys
// Wydatki list.
export function InvoiceDownloadDialog({ fetchRows }: InvoiceDownloadDialogPropsT) {
  const { locale, t } = useTranslation('transfers')
  const searchParams = useSearchParams()
  const { download, isPending: isZipping } = useFileArchive()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRangeT>(ALL_TIME)
  const [rows, setRows] = useState<TransferRowT[]>()
  const [isCounting, setIsCounting] = useState(false)
  const request = useLatestRequest()

  const { from, to } = range
  const isComplete = Boolean(from && to)
  const isInverted = Boolean(from && to && from > to)
  const fileCount = rows ? flattenArchiveRows(rows).length : 0

  async function count({ from: start, to: end }: DateRangeT) {
    const isLatest = request.start()
    setRows(undefined)
    if (!start || !end || start > end) {
      setIsCounting(false)
      return
    }

    setIsCounting(true)
    const result = await settleAction(() => fetchRows({ range: { from: start, to: end } }))
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

    // The table's Od/Do is the range the user already chose; half of it is no range here.
    const tableFrom = dayBound(searchParams.get('from'))
    const tableTo = dayBound(searchParams.get('to'))
    if (tableFrom && tableTo) changeRange({ from: tableFrom, to: tableTo })
  }

  function handleDownload() {
    if (!rows || !from || !to) return
    download(rows, [from, to], INVOICE_ARCHIVE_COPY)
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
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-6" aria-describedby={undefined}>
          <DialogHeader title={t('invoicesDialogTitle')} />

          <DateRangePicker value={range} onChange={changeRange} isPending={isCounting} />

          <p className="text-sm" aria-live="polite">
            {!isComplete && <span className="text-muted-foreground">{t('invoicesPickRange')}</span>}
            {isInverted && <span className="text-destructive">{t('invoicesInvalidRange')}</span>}
            {isComplete && !isInverted && isCounting && (
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {t('invoicesCounting')}
              </span>
            )}
            {rows && t('invoicesCount', { count: fileCount })}
          </p>

          <DialogFooter>
            <Button onClick={handleDownload} disabled={!rows || fileCount === 0 || isZipping}>
              <FileArchive />
              {t('invoicesDownload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
