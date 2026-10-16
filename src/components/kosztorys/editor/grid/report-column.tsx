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

export type ReportModeT = {
  initialQtyByItem: Record<number, number>
  isSummary: boolean
  onReportQty: (itemId: number, qty: number) => void
  showDoneSum: boolean
  showProgress: boolean
  textSize: GridTextSizeT
}

export type ReportFiguresT = {
  stages: KosztorysStageT[]
  worker: Pick<WorkerAudienceT, 'plane' | 'executedQtyByItem'>
}

// globals.css frames the column, so the one place he may type stands out of a read-only sheet.
const REPORT_COLUMN_CLASS = 'kosztorys-report-column'
const REPORT_HEADER_CLASS = 'kosztorys-report-header'
const REPORT_FIGURE_CLASS = 'kosztorys-report-figure'
const REPORT_WIDTH = 170
const PHONE_REPORT_WIDTH = 64
const COMPACT_UNIT_WIDTH = 80
const FIGURE_WIDTH = 130
const PHONE_DONE_SUM_WIDTH = 60
const PHONE_PROGRESS_WIDTH = 56
const COMPACT_DESCRIPTION_MIN_WIDTH = 240
const PHONE_COMPACT_DESCRIPTION_MIN_WIDTH = 160

function ReportHeader({
  label,
  hint,
}: {
  label: MessageKeyT<'report'>
  hint: MessageKeyT<'report'>
}) {
  const { t } = useTranslation('report')
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
  const shownUnit = showsUnit ? columns.find((column) => column.id === 'unit') : undefined
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
