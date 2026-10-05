import type { CellProps, Column } from 'react-datasheet-grid'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { pinnedWidth } from '@/components/kosztorys/editor/grid/column-sizing'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { useTranslation } from '@/hooks/use-translation'
import type { MessageKeyT } from '@/lib/i18n/translations'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { REPORT_FIELD, REPORT_STAGE_ID } from '@/lib/kosztorys/worker-report/report-field'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import type { PreviewSeamsT } from '@/components/kosztorys/editor/use-kosztorys-editor'

// His rozpiska grid as a report form. His etapy stay read-only; he types into one extra „Zgłaszam”
// column, and every edit lands in his draft instead of the server. Which etap it goes to is the
// kierownik's call at verification.
export type ReportModeT = {
  // What the draft already holds, so a reload reopens the column with his unsent work in it.
  initialQtyByItem: Record<number, number>
  // „Inwestycja”: his sheet as it stands — every column, no „Zgłaszam”, nothing to type. Otherwise
  // Opis prac, „Zgłaszam” and whichever of the two figures below he switches on.
  isSummary: boolean
  onReportQty: (itemId: number, qty: number) => void
  showDoneSum: boolean
  showProgress: boolean
}

// Past the screen's width, the page scrolls sideways — the full sheet always, the compact form once
// either figure is on (a phone has room for Opis prac and „Zgłaszam” alone).
export function reportScrollsSideways(
  report: Pick<ReportModeT, 'isSummary' | 'showDoneSum' | 'showProgress'>,
): boolean {
  return report.isSummary || report.showDoneSum || report.showProgress
}

// His etapy for „Wykonano”, every crew's for „Postęp”: like „Pozostało” on his sheet (design #9), an
// item another crew finished must not read as still owed.
export type ReportFiguresT = {
  stages: KosztorysStageT[]
  worker: Pick<WorkerAudienceT, 'plane' | 'executedQtyByItem'>
}

// globals.css frames the column, so the one place he may type stands out of a read-only sheet.
const REPORT_COLUMN_CLASS = 'kosztorys-report-column'
const REPORT_HEADER_CLASS = 'kosztorys-report-header'
const REPORT_WIDTH = 170
// On a phone the description needs every pixel; the header hint wraps to four lines and still fits.
const PHONE_REPORT_WIDTH = 110
// A phone's narrower columns wrap the headers — „Zgłaszam”'s hint most of all — past the sheet's
// resting header height.
export const PHONE_REPORT_HEADER_HEIGHT = 100
const COMPACT_UNIT_WIDTH = 80
const FIGURE_WIDTH = 130
const PHONE_FIGURE_WIDTH = 100
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
  headerClassName: `${REPORT_COLUMN_CLASS} ${REPORT_HEADER_CLASS}`,
}

type ProgressDataT = { executedQtyByItem: Record<number, number> }

// Module-level for one component identity across renders, like ComputedCell: it reads the row's
// „Zgłaszam” live, so the figure moves as he types.
function ProgressCell({ rowData, columnData }: CellProps<KosztorysV2RowT, ProgressDataT>) {
  const done = (columnData.executedQtyByItem[rowData.id] ?? 0) + (rowData[REPORT_FIELD] ?? 0)
  return (
    <ReadOnlyCellText muted danger={done > rowData.plannedQty}>
      {formatQty(done)} / {formatQty(rowData.plannedQty)}
    </ReadOnlyCellText>
  )
}

type FigureColumnsT = {
  doneSum: Column<KosztorysV2RowT> | undefined
  progress: Column<KosztorysV2RowT> | undefined
}

function figureColumns(
  report: ReportModeT,
  { stages, worker }: ReportFiguresT,
  isWide: boolean,
): FigureColumnsT {
  const sizing = {
    ...pinnedWidth(isWide ? FIGURE_WIDTH : PHONE_FIGURE_WIDTH),
    headerClassName: REPORT_HEADER_CLASS,
  }
  const doneSum: Column<KosztorysV2RowT> = {
    ...computedColumn(
      'reportDoneSum',
      <ReportHeader label="doneSumColumn" hint="doneSumColumnHint" />,
      (row) => rowTotalQtyDone(row, stages, worker.plane),
      {},
      (value) => formatQty(value ?? 0),
    ),
    ...sizing,
  }
  const progress: Column<KosztorysV2RowT> = {
    id: 'reportProgress',
    title: <ReportHeader label="progressColumn" hint="progressColumnHint" />,
    disabled: true,
    columnData: { executedQtyByItem: worker.executedQtyByItem },
    component: ProgressCell,
    ...sizing,
  }
  return {
    doneSum: report.showDoneSum ? doneSum : undefined,
    progress: report.showProgress ? progress : undefined,
  }
}

function withReportQty(
  rows: KosztorysV2RowT[],
  qtyByItem: ReportModeT['initialQtyByItem'],
): KosztorysV2RowT[] {
  return rows.map((row) => ({ ...row, [REPORT_FIELD]: qtyByItem[row.id] ?? 0 }))
}

// `showsUnit` is a wider step than `isWide`: with the figures switched on, j.m. squeezes Opis prac
// on a tablet.
export type ReportLayoutT = { isWide: boolean; showsUnit: boolean }

export function reportEditorSeams(
  report: ReportModeT,
  figures: ReportFiguresT,
  { isWide, showsUnit }: ReportLayoutT,
): PreviewSeamsT {
  return {
    transformColumns: (columns) =>
      report.isSummary
        ? columns
        : compactReportColumns(columns, figureColumns(report, figures, isWide), {
            isWide,
            showsUnit,
          }),
    initialRowPatch: (rows) => withReportQty(rows, report.initialQtyByItem),
    // Every other column is disabled, so „Zgłaszam” is the only change a batch can carry.
    onPreviewChange: (stageChanges) => {
      for (const change of stageChanges) {
        if (change.stageId === REPORT_STAGE_ID) report.onReportQty(change.id, change.after)
      }
    },
  }
}

function compactReportColumns(
  columns: Column<KosztorysV2RowT>[],
  { doneSum, progress }: FigureColumnsT,
  { isWide, showsUnit }: ReportLayoutT,
): Column<KosztorysV2RowT>[] {
  const description = columns.find((column) => column.id === 'description')
  // By id, like Opis prac: the owner's worker view may have hidden it.
  const shownUnit = showsUnit ? columns.find((column) => column.id === 'unit') : undefined
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
  const report = isWide ? reportColumn : { ...reportColumn, ...pinnedWidth(PHONE_REPORT_WIDTH) }
  return [stretched, doneSum, report, progress, unit].filter((column) => column !== undefined)
}
