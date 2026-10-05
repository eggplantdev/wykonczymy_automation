import type { Column } from 'react-datasheet-grid'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { pinnedWidth } from '@/components/kosztorys/editor/grid/column-sizing'
import { useTranslation } from '@/hooks/use-translation'
import type { MessageKeyT } from '@/lib/i18n/translations'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { REPORT_FIELD, REPORT_STAGE_ID } from '@/lib/kosztorys/worker-report/report-field'
import type { KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import type { PreviewSeamsT } from '@/components/kosztorys/editor/use-kosztorys-editor'

// His rozpiska grid as a report form. His etapy stay read-only; he types into one extra „Zgłaszam”
// column, and every edit lands in his draft instead of the server. Which etap it goes to is the
// kierownik's call at verification.
export type ReportModeT = {
  // What the draft already holds, so a reload reopens the column with his unsent work in it.
  initialQtyByItem: Record<number, number>
  // „Inwestycja”: his sheet as it stands — every column, no „Zgłaszam”, nothing to type. Otherwise
  // only Opis prac and „Zgłaszam”.
  isSummary: boolean
  onReportQty: (itemId: number, qty: number) => void
}

// globals.css frames the column, so the one place he may type stands out of a read-only sheet.
const REPORT_COLUMN_CLASS = 'kosztorys-report-column'
const REPORT_WIDTH = 170
// On a phone the description needs every pixel; the header hint wraps to four lines and still fits.
const PHONE_REPORT_WIDTH = 110
// A phone's narrower columns wrap the headers — „Zgłaszam”'s hint most of all — past the sheet's
// resting header height.
export const PHONE_REPORT_HEADER_HEIGHT = 100
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

function withReportQty(
  rows: KosztorysV2RowT[],
  qtyByItem: ReportModeT['initialQtyByItem'],
): KosztorysV2RowT[] {
  return rows.map((row) => ({ ...row, [REPORT_FIELD]: qtyByItem[row.id] ?? 0 }))
}

export function reportEditorSeams(report: ReportModeT, isWide: boolean): PreviewSeamsT {
  return {
    transformColumns: (columns) =>
      report.isSummary ? columns : compactReportColumns(columns, isWide),
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
  isWide: boolean,
): Column<KosztorysV2RowT>[] {
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
  const report = isWide ? reportColumn : { ...reportColumn, ...pinnedWidth(PHONE_REPORT_WIDTH) }
  return [stretched, report, unit].filter((column) => column !== undefined)
}
