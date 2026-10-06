'use client'

import { useTransition } from 'react'
import { openPrintWindow, printThenClose } from '@/lib/utils/print-window'
import type { Table } from '@tanstack/react-table'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { TransferRowsFetchT } from '@/components/transfers/transfer-table-config'
import { columnLabel } from '@/lib/table/column-label'
import {
  buildTransfersPrintHtml,
  type PrintColumnT,
} from '@/lib/transfers/build-transfers-print-html'
import { sortingStateToParam } from '@/lib/table/sort-param'
import type { TransferRowT } from '@/types/transfers'
import { useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'

type PrintTransfersButtonPropsT = {
  fetchRows: TransferRowsFetchT
  table: Table<TransferRowT>
  title: string
}

export function PrintTransfersButton({ fetchRows, table, title }: PrintTransfersButtonPropsT) {
  const { locale, t } = useTranslation('transfers')
  const [isPending, startTransition] = useTransition()

  function handlePrint() {
    // getVisibleLeafColumns already applies the table's columnOrder, so this is the reader's own
    // column order — nothing separate has to read the stored ranks.
    const columns: PrintColumnT[] = table.getVisibleLeafColumns().flatMap((column) => {
      const printValue = column.columnDef.meta?.printValue
      return printValue ? [{ id: column.id, label: columnLabel(column), getValue: printValue }] : []
    })
    if (columns.length === 0) {
      toastMessage(t('printNoColumns'), 'info')
      return
    }

    // Opened before the fetch, not after: the helper needs this click's user activation.
    const printWindow = openPrintWindow(title)
    if (!printWindow) {
      toastMessage(t('printBlocked'), 'error')
      return
    }
    if (printWindow.document.body) printWindow.document.body.textContent = t('printPreparing')

    startTransition(async () => {
      // Refetches instead of reusing the table's rows: the table is paginated, the printout isn't.
      // The screen's sort key travels along, so both sets order the same way.
      const result = await settleAction(() =>
        fetchRows({
          skipMedia: true,
          sort: sortingStateToParam(table.getState().sorting) || undefined,
        }),
      )
      if (!result.success) {
        printWindow.close()
        toastMessage(failureMessage(locale, result), 'error')
        return
      }

      const rows = result.data
      if (rows.length === 0) {
        printWindow.close()
        toastMessage(t('printEmpty'), 'info')
        return
      }

      printWindow.document.write(buildTransfersPrintHtml(rows, columns, title, locale))
      printWindow.document.close()
      printThenClose(printWindow)
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isPending}
      aria-label={t('printAria')}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Printer />}
      {t('print')}
    </Button>
  )
}
