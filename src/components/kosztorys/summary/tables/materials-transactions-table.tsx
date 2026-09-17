'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { InvoicePreviewButton } from '@/components/dialogs/invoice-preview-button'
import { useInvoiceZip } from '@/hooks/use-invoice-zip'
import { buildInvoiceArchiveName } from '@/lib/invoices/invoice-zip'
import { firstNoteLine } from '@/lib/utils/invoice-note'
import { formatNet } from '@/lib/kosztorys/format'
import {
  availableExpenseDatasets,
  clientVisibleExpenseRows,
  partitionExpenseRows,
  sumBilled,
  expenseRowHref,
  type ExpenseDatasetT,
} from '@/lib/kosztorys/expense-datasets'
import { formatPLDate } from '@/lib/utils/format-date'
import { today } from '@/lib/utils/date'
import type { MaterialTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  // Names the downloaded archive, so two investments pulled the same day don't collide in Downloads.
  investmentName: string
  // Every expense type and both settled states — the tabs split them.
  rows: MaterialTransactionRowT[]
  // Read-only public/preview render: no row links (they point into the app, which a client can't
  // reach), and the settled set is dropped rather than merely unlinked.
  preview?: boolean
}

const DATASET_LABELS: Record<ExpenseDatasetT, string> = {
  gross: 'Materiały brutto',
  net: 'Materiały rozliczane netto',
  settled: 'Materiały wliczone w robociznę',
}

const TABLE_HEIGHT = 400
// 8px taller than the wypłaty list: a text-only row is 36 (20px line box + py-2), leaving no budget
// for the „Faktura" control's 28px box. The virtualizer estimates from this number and never measures,
// so drift here is silent — keep it in step with whatever the tallest cell renders.
const ROW_HEIGHT = 44
// The scroll container wraps thead + tbody + tfoot together, so a height computed from body rows
// alone clips the header and the „Razem" footer — budget their rendered height too.
const HEADER_HEIGHT = 41
const FOOTER_HEIGHT = 41

// Every column carries an explicit size: the virtualized table lays out fixed, so an unsized column
// would fall back to TanStack's uniform 150 and hand „Data" as much room as „Opis".
const SHARED_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    size: 96,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPLDate(getValue<string>())}</span>
    ),
  },
  { accessorKey: 'label', header: 'Kategoria', size: 160 },
  {
    accessorKey: 'description',
    header: 'Opis',
    size: 260,
    enableSorting: false,
    // DataTable does no column sizing, so an auto-width <td> lets a long opis run through its
    // neighbour; full text on hover.
    cell: ({ getValue }) => {
      const description = getValue<string | null>()
      if (!description) return <span className="text-muted-foreground">—</span>
      return (
        <SimpleTooltip content={description}>
          <span className="text-muted-foreground block max-w-64 cursor-help truncate">
            {description}
          </span>
        </SimpleTooltip>
      )
    },
  },
  {
    accessorKey: 'invoiceNote',
    header: 'Notatka',
    size: 160,
    enableSorting: false,
    cell: ({ getValue }) => {
      const note = getValue<string | null>()
      const firstLine = firstNoteLine(note)
      if (!firstLine || !note) return <span className="text-muted-foreground">—</span>
      // A <button>, not plain text: it gives the tooltip a tab stop (the rest of the note exists
      // nowhere else on the page), and DataTable's row-link handler skips clicks landing on a button,
      // so reading the note doesn't navigate away. The width cap has to live here too — DataTable has
      // no column sizing, so an auto-width <td> ignores `truncate`.
      return (
        <SimpleTooltip content={note}>
          <button
            type="button"
            className="text-muted-foreground focus-visible:ring-ring/50 block max-w-32 cursor-help truncate text-left focus-visible:ring-3"
          >
            {firstLine}
          </button>
        </SimpleTooltip>
      )
    },
  },
  {
    accessorKey: 'invoices',
    header: 'Faktura',
    size: 88,
    enableSorting: false,
    meta: { align: 'center' },
    // Sits before the money columns, not last, so the „Razem" footer's total stays under the column
    // it actually sums. The empty branch still reserves the control's box: the virtualizer estimates
    // every row at ROW_HEIGHT and never measures, so an invoice-less row collapsing to the text line
    // height would drift the spacers.
    cell: ({ row }) =>
      row.original.invoices.length > 0 ? (
        <InvoicePreviewButton
          invoices={row.original.invoices}
          variant="compact"
          className="size-7"
        />
      ) : (
        <span className="mx-auto block size-7" />
      ),
  },
]

const moneyColumn = (
  accessorKey: 'amount' | 'billed',
  header: string,
): ColumnDef<MaterialTransactionRowT> => ({
  accessorKey,
  header,
  size: 120,
  meta: { align: 'right' },
  cell: ({ getValue }) => <span className="tabular-nums">{formatNet(getValue<number>())}</span>,
})

// Netto first: it is the figure this dataset actually bills, so it reads before the brutto it was
// crossed from. „Razem" sums `billed`, so the footer has to skip a column to land under it.
const NET_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  ...SHARED_COLUMNS,
  moneyColumn('billed', 'Netto'),
  moneyColumn('amount', 'Brutto'),
]

// The brutto sets bill at `amount`, so one column says everything.
const GROSS_COLUMNS: ColumnDef<MaterialTransactionRowT>[] = [
  ...SHARED_COLUMNS,
  moneyColumn('amount', 'Kwota'),
]

// The wydatki list — one row per materiały transaction, the un-summed twin of the „Wydatki
// inwestycyjne" breakdown above it.
export function MaterialsTransactionsTable({
  investmentId,
  investmentName,
  rows,
  preview = false,
}: PropsT) {
  const partition = partitionExpenseRows(preview ? clientVisibleExpenseRows(rows) : rows)
  const available = availableExpenseDatasets(partition)
  const [dataset, setDataset] = useState<ExpenseDatasetT>('gross')
  const { download, isPending } = useInvoiceZip()
  // A prop change can empty the picked set (an expense re-categorised away); fall back rather than
  // render a tab with nothing in it.
  const activeDataset = available.includes(dataset) ? dataset : (available[0] ?? 'gross')
  const visibleRows = partition[activeDataset]
  // Rows are already here, so an empty active dataset is knowable up front — no point offering a
  // button that could only ever answer „brak faktur". (The transfers variant can't know until it fetches.)
  const hasInvoices = visibleRows.some((row) => row.invoices.length > 0)

  // The count rides in the label because a tab is otherwise silent about its size — „Pobierz faktury"
  // packs the whole active set, so how many rows that is has to be visible before the click.
  const options: OptionT<ExpenseDatasetT>[] = available.map((set) => ({
    value: set,
    label: `${DATASET_LABELS[set]} (${partition[set].length})`,
  }))

  if (available.length === 0) return null

  function handleDownload() {
    const date = today()
    download(
      visibleRows,
      buildInvoiceArchiveName([investmentName, DATASET_LABELS[activeDataset]], date),
    )
  }

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex w-full items-center gap-2">
        {options.length > 1 && (
          <ToggleGroup
            options={options}
            value={activeDataset}
            onChange={setDataset}
            aria-label="Zestaw wydatków"
          />
        )}
        {hasInvoices && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isPending}
            className="ml-auto"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <FileArchive />}
            Pobierz faktury
          </Button>
        )}
      </div>
      <DataTable
        key={activeDataset}
        data={visibleRows}
        columns={activeDataset === 'net' ? NET_COLUMNS : GROSS_COLUMNS}
        enableVirtualization
        virtualRowHeight={ROW_HEIGHT}
        virtualContainerHeight={Math.min(
          visibleRows.length * ROW_HEIGHT + HEADER_HEIGHT + FOOTER_HEIGHT,
          TABLE_HEIGHT,
        )}
        initialSorting={[{ id: 'date', desc: true }]}
        getRowHref={preview ? undefined : (row) => expenseRowHref(investmentId, row)}
        footer={(visibleColumnIds) => (
          <tr>
            {/* The total is of `billed`, which the netto set renders second-to-last — so the label
                spans one column less there, and the trailing Brutto column gets an empty cell. */}
            <td
              className="font-bold"
              colSpan={visibleColumnIds.length - (activeDataset === 'net' ? 2 : 1)}
            >
              Razem
            </td>
            <td className="text-right font-bold tabular-nums">
              {formatNet(sumBilled(visibleRows))}
            </td>
            {activeDataset === 'net' && <td />}
          </tr>
        )}
        className="w-full"
      />
    </div>
  )
}
