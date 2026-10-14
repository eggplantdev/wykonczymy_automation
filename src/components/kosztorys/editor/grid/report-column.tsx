import type { CellProps, Column } from 'react-datasheet-grid'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { pinnedWidth } from '@/components/kosztorys/editor/grid/column-sizing'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { useTranslation } from '@/hooks/use-translation'
import type { MessageKeyT } from '@/lib/i18n/translations'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { resolvedCurrentPlannedQty } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { REPORT_FIELD, REPORT_STAGE_ID } from '@/lib/kosztorys/worker-report/report-field'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
import type { KosztorysStageT, KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import type { PreviewSeamsT } from '@/components/kosztorys/editor/use-kosztorys-editor'
import type { GridTextSizeT } from '@/components/kosztorys/editor/hooks/use-grid-text-size'

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
  textSize: GridTextSizeT
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
// The three number columns; globals.css centres their figures.
const REPORT_FIGURE_CLASS = 'kosztorys-report-figure'
const REPORT_WIDTH = 170
// A phone stands the titles on end, so these fit the figures alone (`123,45`; Postęp wraps after its
// „/”), and with Opis prac's phone minimum all four columns fit a 360px screen without scrolling.
const PHONE_REPORT_WIDTH = 64
const COMPACT_UNIT_WIDTH = 80
const FIGURE_WIDTH = 130
const PHONE_DONE_SUM_WIDTH = 60
const PHONE_PROGRESS_WIDTH = 56
const COMPACT_DESCRIPTION_MIN_WIDTH = 240
const PHONE_COMPACT_DESCRIPTION_MIN_WIDTH = 160

// A component, not inline JSX: the column is a module constant, so only a render can read the language.
function ReportHeader({
  label,
  hint,
}: {
  label: MessageKeyT<'report'>
  hint: MessageKeyT<'report'>
}) {
  const { t } = useTranslation('report')
  // The preview bolds every header span, and the hint must stay quiet. A phone gets the title alone,
  // on end: either one lying flat is what set the column's width.
  return (
    <div className="flex flex-col gap-0.5 whitespace-normal">
      <HeaderLabel className="max-sm:vertical-text max-sm:whitespace-nowrap">
        {t(label)}
      </HeaderLabel>
      <div className="text-muted-foreground text-2xs leading-tight max-sm:hidden">{t(hint)}</div>
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
  cellClassName: `${REPORT_COLUMN_CLASS} ${REPORT_FIGURE_CLASS}`,
  headerClassName: `${REPORT_COLUMN_CLASS} ${REPORT_HEADER_CLASS}`,
}

type ProgressDataT = { executedQtyByItem: Record<number, number> }

function progressFigures(row: KosztorysV2RowT, executedQtyByItem: Record<number, number>) {
  const done = (executedQtyByItem[row.id] ?? 0) + (row[REPORT_FIELD] ?? 0)
  const plannedQty = resolvedCurrentPlannedQty(row)
  return { done, plannedQty, text: `${formatQty(done)} / ${formatQty(plannedQty)}` }
}

// Module-level for one component identity across renders, like ComputedCell: it reads the row's
// „Zgłaszam” live, so the figure moves as he types.
function ProgressCell({ rowData, columnData }: CellProps<KosztorysV2RowT, ProgressDataT>) {
  const { done, plannedQty, text } = progressFigures(rowData, columnData.executedQtyByItem)
  return (
    <ReadOnlyCellText muted danger={done > plannedQty}>
      {text}
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
  const sizing = (phoneWidth: number) => ({
    ...pinnedWidth(isWide ? FIGURE_WIDTH : phoneWidth),
    cellClassName: REPORT_FIGURE_CLASS,
    headerClassName: REPORT_HEADER_CLASS,
  })
  const doneSum: Column<KosztorysV2RowT> = {
    ...computedColumn(
      'reportDoneSum',
      <ReportHeader label="doneSumColumn" hint="doneSumColumnHint" />,
      (row) => rowTotalQtyDone(row, stages, worker.plane),
      {},
      (value) => formatQty(value ?? 0),
    ),
    ...sizing(PHONE_DONE_SUM_WIDTH),
  }
  const progress: Column<KosztorysV2RowT> = {
    id: 'reportProgress',
    title: <ReportHeader label="progressColumn" hint="progressColumnHint" />,
    disabled: true,
    columnData: { executedQtyByItem: worker.executedQtyByItem },
    component: ProgressCell,
    // Also what measures the row: a phone's narrow column wraps the figure after its „/”.
    copyValue: ({ rowData }) => progressFigures(rowData, worker.executedQtyByItem).text,
    ...sizing(PHONE_PROGRESS_WIDTH),
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
  const descriptionMinWidth = isWide
    ? COMPACT_DESCRIPTION_MIN_WIDTH
    : PHONE_COMPACT_DESCRIPTION_MIN_WIDTH
  const stretched = description && {
    ...description,
    basis: descriptionMinWidth,
    grow: 1,
    shrink: 1,
    minWidth: descriptionMinWidth,
    maxWidth: undefined,
  }
  const report = isWide ? reportColumn : { ...reportColumn, ...pinnedWidth(PHONE_REPORT_WIDTH) }
  return [stretched, doneSum, report, progress, unit].filter((column) => column !== undefined)
}
