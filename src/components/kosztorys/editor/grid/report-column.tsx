import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { pinnedWidth } from '@/components/kosztorys/editor/grid/column-sizing'
import { withCellClass } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { useTranslation } from '@/hooks/use-translation'
import type { MessageKeyT } from '@/lib/i18n/translations'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { STAGE_QTY_PREFIX, stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import type { PreviewSeamsT } from '@/components/kosztorys/editor/use-kosztorys-editor'

// His rozpiska grid as a report form. His etapy stay read-only; he types into one extra „Zgłaszam”
// column, and every edit lands in his draft instead of the server. Which etap it goes to is the
// kierownik's call at verification.
export type ReportModeT = {
  // What the draft already holds, so a reload reopens the column with his unsent work in it.
  initialQtyByItem: Record<number, number>
  pendingQtyByItem: Record<number, number>
  // Only Opis prac and „Zgłaszam” — the rest of the sheet is context he can switch back to.
  isCompact: boolean
  onReportQty: (itemId: number, qty: number) => void
}

// A stage id no etap can hold (serial ids start at 1), so the report rides the stage-qty field
// plumbing — the diff reports it like an etap edit — while every Σ etapów, which iterates the real
// etapy, never counts it into Pomiar.
const REPORT_STAGE_ID = 0
const REPORT_FIELD = stageKey(REPORT_STAGE_ID)

// globals.css frames the column, so the one place he may type stands out of a read-only sheet.
const REPORT_COLUMN_CLASS = 'kosztorys-report-column'
// globals.css greys these: every figure he reads but may not type, so „Zgłaszam” is the one dark number.
const READONLY_FIGURE_CLASS = 'kosztorys-report-readonly-figure'
const TEXT_COLUMN_IDS: ReadonlySet<string> = new Set(['description', 'note', 'sectionName', 'unit'])
const REPORT_WIDTH = 140
// On a phone the description needs every pixel; the header hint wraps to four lines and still fits.
const COMPACT_REPORT_WIDTH = 110
const COMPACT_UNIT_WIDTH = 80
const COMPACT_DESCRIPTION_MIN_WIDTH = 240

// A component, not inline JSX: the column is a module constant, so only a render can read the language.
function ReportHeader({
  label,
  hint,
}: {
  label: MessageKeyT<'report'>
  hint: MessageKeyT<'report'>
}) {
  const { t } = useTranslation('report')
  // The preview bolds every header span, and the hint must stay quiet.
  return (
    <div className="flex flex-col gap-0.5 whitespace-normal">
      <div className="font-bold">{t(label)}</div>
      <div className="text-muted-foreground text-xs leading-tight">{t(hint)}</div>
    </div>
  )
}

const reportColumn: Column<KosztorysV2RowT> = {
  ...decimalColumn(
    REPORT_FIELD,
    <ReportHeader label="reportColumn" hint="reportColumnHint" />,
    numericFieldPolicy<StageKeyT, KosztorysV2RowT>(REPORT_FIELD, formatQty),
  ),
  ...pinnedWidth(REPORT_WIDTH),
  cellClassName: REPORT_COLUMN_CLASS,
  headerClassName: REPORT_COLUMN_CLASS,
}

const PENDING_WIDTH = 110

type PendingCellDataT = { pendingQtyByItem: ReportModeT['pendingQtyByItem'] }

// Stable component, map via columnData: an inline component remounts every cell on each render.
function PendingQtyCell({ rowData, columnData }: CellProps<KosztorysV2RowT, PendingCellDataT>) {
  const qty = columnData.pendingQtyByItem[rowData.id]
  return <ReadOnlyCellText muted>{qty ? formatQty(qty) : ''}</ReadOnlyCellText>
}

// What he already sent and the kierownik has not decided yet, so a repeat report is visible before
// he types it twice.
function pendingColumn(
  pendingQtyByItem: ReportModeT['pendingQtyByItem'],
): Column<KosztorysV2RowT, PendingCellDataT> {
  return {
    id: 'reportPending',
    title: <ReportHeader label="pendingColumn" hint="pendingColumnHint" />,
    columnData: { pendingQtyByItem },
    component: PendingQtyCell,
    disabled: true,
    copyValue: ({ rowData }) => pendingQtyByItem[rowData.id] ?? '',
    ...pinnedWidth(PENDING_WIDTH),
  }
}

function withReportQty(
  rows: KosztorysV2RowT[],
  qtyByItem: ReportModeT['initialQtyByItem'],
): KosztorysV2RowT[] {
  return rows.map((row) => ({ ...row, [REPORT_FIELD]: qtyByItem[row.id] ?? 0 }))
}

export function reportEditorSeams(report: ReportModeT, isWide: boolean): PreviewSeamsT {
  return {
    transformColumns: (columns) => withReportColumn(columns, report, isWide),
    initialRowPatch: (rows) => withReportQty(rows, report.initialQtyByItem),
    // Every other column is disabled, so „Zgłaszam” is the only change a batch can carry.
    onPreviewChange: (stageChanges) => {
      for (const change of stageChanges) {
        if (change.stageId === REPORT_STAGE_ID) report.onReportQty(change.id, change.after)
      }
    },
  }
}

// „Czeka” rides only the full sheet: on the compact view a third figure would push „Zgłaszam” off a phone, and his sent reports
// list says the same thing below the grid.
function withReportColumn(
  columns: Column<KosztorysV2RowT>[],
  { isCompact, pendingQtyByItem }: Pick<ReportModeT, 'isCompact' | 'pendingQtyByItem'>,
  isWide: boolean,
): Column<KosztorysV2RowT>[] {
  if (isCompact) {
    const description = columns.find((column) => column.id === 'description')
    // By id, like Opis prac: the owner's worker view may have hidden it. A phone has no room for it.
    const shownUnit = isWide ? columns.find((column) => column.id === 'unit') : undefined
    // Fixed like „Zgłaszam”, so all the room a wide screen adds goes to Opis prac.
    const unit = shownUnit && { ...shownUnit, ...pinnedWidth(COMPACT_UNIT_WIDTH) }
    // Unpinned: a width the owner dragged on the full sheet would leave the compact one half empty.
    const stretched = description && {
      ...description,
      basis: COMPACT_DESCRIPTION_MIN_WIDTH,
      grow: 1,
      shrink: 1,
      minWidth: COMPACT_DESCRIPTION_MIN_WIDTH,
      maxWidth: undefined,
    }
    const narrowed = { ...reportColumn, ...pinnedWidth(COMPACT_REPORT_WIDTH) }
    return [stretched, narrowed, unit].filter((column) => column !== undefined)
  }
  const lastStage = columns.findLastIndex((column) => column.id?.startsWith(STAGE_QTY_PREFIX))
  const anchor =
    lastStage === -1 ? columns.findIndex((column) => column.id === 'description') : lastStage
  const greyed = columns.map((column) =>
    column.id && TEXT_COLUMN_IDS.has(column.id)
      ? column
      : { ...column, cellClassName: withCellClass(column.cellClassName, READONLY_FIGURE_CLASS) },
  )
  const hasPending = Object.keys(pendingQtyByItem).length > 0
  const inserted = hasPending
    ? [pendingColumn(pendingQtyByItem) as Column<KosztorysV2RowT>, reportColumn]
    : [reportColumn]
  return greyed.toSpliced(anchor + 1, 0, ...inserted)
}
