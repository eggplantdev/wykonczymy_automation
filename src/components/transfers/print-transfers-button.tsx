'use client'

import { useTransition } from 'react'
import type { Where } from 'payload'
import type { Table } from '@tanstack/react-table'
import { Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/lib/utils/toast'
import { fetchFilteredTransfers } from '@/lib/actions/fetch-transfers-for-invoices'
import { columnLabel } from '@/lib/table/column-label'
import {
  buildTransfersPrintHtml,
  type PrintColumnT,
} from '@/lib/transfers/build-transfers-print-html'
import { sortingStateToParam } from '@/lib/table/sort-param'
import type { TransferRowT } from '@/types/transfers'

type PrintTransfersButtonPropsT = {
  where: Where
  table: Table<TransferRowT>
  title: string
}

export function PrintTransfersButton({ where, table, title }: PrintTransfersButtonPropsT) {
  const [isPending, startTransition] = useTransition()

  function handlePrint() {
    // getVisibleLeafColumns already applies the table's columnOrder, so this is the reader's own
    // column order — nothing separate has to read the stored ranks.
    const columns: PrintColumnT[] = table.getVisibleLeafColumns().flatMap((column) => {
      const printValue = column.columnDef.meta?.printValue
      return printValue ? [{ id: column.id, label: columnLabel(column), getValue: printValue }] : []
    })
    if (columns.length === 0) {
      toastMessage('Brak kolumn do wydruku', 'info')
      return
    }

    // Opened here, synchronously, and not after the fetch: a browser grants window.open only while
    // the click's user activation lasts, which an await spends — Safari refuses outright, Chrome
    // after a few seconds. about:blank inherits our origin; a blob:/data: window gets an opaque one.
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    printWindow.document.title = title
    if (printWindow.document.body) printWindow.document.body.textContent = 'Przygotowuję wydruk…'

    startTransition(async () => {
      // Refetches instead of reusing the table's rows: the table is paginated, the printout is not.
      // The screen's sort key travels with the request, so the database orders both sets the same
      // way and nothing here re-sorts what comes back.
      const result = await fetchFilteredTransfers(where, {
        skipMedia: true,
        sort: sortingStateToParam(table.getState().sorting) || undefined,
      })
      if (!result.success) {
        printWindow.close()
        toastMessage(result.error ?? 'Nie udało się pobrać danych', 'error')
        return
      }

      const rows = result.data
      if (rows.length === 0) {
        printWindow.close()
        toastMessage('Brak transakcji do wydruku', 'info')
        return
      }

      printWindow.document.write(buildTransfersPrintHtml(rows, columns, title))
      printWindow.document.close()
      // Closing on afterprint rather than straight after print(): only Chrome blocks inside print(),
      // so an immediate close() tears the window down mid-job in Safari and Firefox. The document
      // loads no external resource, so it is fully parsed by close() and can print at once.
      printWindow.addEventListener('afterprint', () => printWindow.close())
      printWindow.print()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={isPending}
      aria-label="Drukuj transakcje"
    >
      {isPending ? <Loader2 className="animate-spin" /> : <Printer />}
      Drukuj
    </Button>
  )
}
