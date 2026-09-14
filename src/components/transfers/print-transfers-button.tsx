'use client'

import { useTransition } from 'react'
import type { Where } from 'payload'
import type { Table } from '@tanstack/react-table'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { fetchFilteredTransfers } from '@/lib/actions/fetch-transfers-for-invoices'
import { columnLabel } from '@/lib/table/column-label'
import {
  buildTransfersPrintHtml,
  type PrintColumnT,
} from '@/lib/transfers/build-transfers-print-html'
import { sortTransferRows } from '@/lib/transfers/sort-transfer-rows'
import type { TransferRowT } from '@/types/transfers'

type PrintTransfersButtonPropsT = {
  where: Where
  table: Table<TransferRowT>
  title: string
}

const TOAST_OPTIONS = { position: 'bottom-center', theme: 'dark' } as const

export function PrintTransfersButton({ where, table, title }: PrintTransfersButtonPropsT) {
  const [isPending, startTransition] = useTransition()

  function handlePrint() {
    // getVisibleLeafColumns already applies the table's columnOrder, so this is the reader's own
    // column order — nothing separate has to read the stored ranks.
    const columns: PrintColumnT[] = table.getVisibleLeafColumns().flatMap((column) => {
      const printValue = column.columnDef.meta?.printValue
      return printValue ? [{ id: column.id, label: columnLabel(column), getValue: printValue }] : []
    })

    startTransition(async () => {
      // Refetches instead of reusing the table's rows: the table is paginated, the printout is not.
      const result = await fetchFilteredTransfers(where)
      if (!result.success) {
        toast.error(result.error ?? 'Nie udało się pobrać danych', TOAST_OPTIONS)
        return
      }

      const rows = sortTransferRows(result.data, table.getState().sorting)
      if (rows.length === 0) {
        toast.info('Brak transakcji do wydruku', TOAST_OPTIONS)
        return
      }

      // about:blank inherits our origin; a blob:/data: window gets an opaque one — same reasoning as
      // the invoice preview's print. Nothing external loads here, so print() can fire immediately.
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Przeglądarka zablokowała okno wydruku', TOAST_OPTIONS)
        return
      }

      printWindow.document.write(buildTransfersPrintHtml(rows, columns, title))
      printWindow.document.close()
      printWindow.print()
      printWindow.close()
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
