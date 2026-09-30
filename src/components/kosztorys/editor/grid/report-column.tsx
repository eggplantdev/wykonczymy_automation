import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { withCellClass } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { STAGE_QTY_PREFIX, stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import type { PreviewSeamsT } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { ReportModeT } from '@/lib/kosztorys/worker-report/types'

// A stage id no etap can hold (serial ids start at 1), so the report rides the stage-qty field
// plumbing — the diff reports it like an etap edit — while every Σ etapów, which iterates the real
// etapy, never counts it into Pomiar.
export const REPORT_STAGE_ID = 0
const REPORT_FIELD = stageKey(REPORT_STAGE_ID)

// globals.css frames the column, so the one place he may type stands out of a read-only sheet.
const REPORT_COLUMN_CLASS = 'kosztorys-report-column'
// globals.css greys these: every figure he reads but may not type, so „Zgłaszam” is the one dark number.
const READONLY_FIGURE_CLASS = 'kosztorys-report-readonly-figure'
const TEXT_COLUMN_IDS: ReadonlySet<string> = new Set(['description', 'note', 'sectionName', 'unit'])
// Compact leaves Opis prac and „Zgłaszam”; the number needs a fixed slot, the description the rest.
const REPORT_WIDTH = 140
// On a phone the description needs every pixel; the header hint wraps to four lines and still fits.
const COMPACT_REPORT_WIDTH = 110
const COMPACT_DESCRIPTION_MIN_WIDTH = 240

const reportColumn: Column<KosztorysV2RowT> = {
  ...decimalColumn(
    REPORT_FIELD,
    // A div, not a span: the preview bolds every header span, and the hint must stay quiet.
    <div className="flex flex-col gap-0.5 whitespace-normal">
      <div className="font-bold">Zgłaszam</div>
      <div className="text-muted-foreground text-xs leading-tight">
        wpisz, ile wykonano od ostatniego zgłoszenia.
      </div>
    </div>,
    numericFieldPolicy<StageKeyT, KosztorysV2RowT>(REPORT_FIELD, formatQty),
  ),
  basis: REPORT_WIDTH,
  grow: 0,
  shrink: 0,
  minWidth: REPORT_WIDTH,
  maxWidth: REPORT_WIDTH,
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
    title: (
      <div className="flex flex-col gap-0.5 whitespace-normal">
        <div className="font-bold">Czeka</div>
        <div className="text-muted-foreground text-xs leading-tight">wysłane, niesprawdzone</div>
      </div>
    ),
    columnData: { pendingQtyByItem },
    component: PendingQtyCell,
    disabled: true,
    copyValue: ({ rowData }) => pendingQtyByItem[rowData.id] ?? '',
    basis: PENDING_WIDTH,
    grow: 0,
    shrink: 0,
    minWidth: PENDING_WIDTH,
    maxWidth: PENDING_WIDTH,
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

// „Zgłaszam” right after his last etap, on the read-only worker grid. „Czeka” rides only the full
// sheet: on the compact view a third figure would push „Zgłaszam” off a phone, and his sent reports
// list says the same thing below the grid.
function withReportColumn(
  columns: Column<KosztorysV2RowT>[],
  { isCompact, pendingQtyByItem }: Pick<ReportModeT, 'isCompact' | 'pendingQtyByItem'>,
  isWide: boolean,
): Column<KosztorysV2RowT>[] {
  if (isCompact) {
    const description = columns.find((column) => column.id === 'description')
    // By id, like Opis prac: the owner's worker view may have hidden it. A phone has no room for it.
    const unit = isWide ? columns.find((column) => column.id === 'unit') : undefined
    // Unpinned: a width the owner dragged on the full sheet would leave the compact one half empty.
    const stretched = description && {
      ...description,
      basis: COMPACT_DESCRIPTION_MIN_WIDTH,
      grow: 1,
      shrink: 1,
      minWidth: COMPACT_DESCRIPTION_MIN_WIDTH,
      maxWidth: undefined,
    }
    const narrowed = {
      ...reportColumn,
      basis: COMPACT_REPORT_WIDTH,
      minWidth: COMPACT_REPORT_WIDTH,
      maxWidth: COMPACT_REPORT_WIDTH,
    }
    return [stretched, unit, narrowed].filter((column) => column !== undefined)
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
