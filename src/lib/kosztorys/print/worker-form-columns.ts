import type { LanguageT } from '@/lib/i18n/languages'
import { getTranslations } from '@/lib/i18n/translations'
import { DESCRIPTION_COLUMN, UNIT_COLUMN, type PrintColumnT } from '@/lib/kosztorys/print/columns'
import { resolvedCurrentPlannedQty } from '@/lib/kosztorys/calc'
import { formatQty } from '@/lib/kosztorys/format'
import { rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { escapeHtml } from '@/lib/utils/escape-html'

export type WorkerFormColumnsArgsT = {
  locale: LanguageT
  plane: ToolPlaneT
  // Only the worker's own etapy — the projection's `tree.stages`.
  stages: KosztorysStageT[]
  executedQtyByItem: Record<number, number>
}

const figureColumn = (key: string, label: string, cell: PrintColumnT['cell']): PrintColumnT => ({
  key,
  label,
  colClass: 'c-figure',
  cellClass: 'num figure',
  headerClass: 'num',
  cell,
})

// The link's report form on paper, in its order: „Wykonano” from his etapy, „Postęp” from every
// crew's, and the blank „Zgłaszam” between them where he writes.
export function workerFormColumns({
  locale,
  plane,
  stages,
  executedQtyByItem,
}: WorkerFormColumnsArgsT): PrintColumnT[] {
  const { grid, report } = getTranslations(locale)
  return [
    {
      key: 'ref',
      label: report.formNumber,
      colClass: 'c-ref',
      cellClass: 'ref',
      headerClass: '',
      cell: (row) => (row.ref === undefined ? '' : escapeHtml(formatFormRef(row.ref))),
    },
    { ...DESCRIPTION_COLUMN, label: grid.description },
    figureColumn('doneSum', report.formDoneSum, (row) =>
      escapeHtml(formatQty(rowTotalQtyDone(row, stages, plane))),
    ),
    {
      key: 'report',
      label: report.reportColumn,
      colClass: 'c-write',
      cellClass: '',
      headerClass: '',
      cell: () => '',
    },
    figureColumn('progress', report.formProgress, (row) =>
      escapeHtml(
        `${formatQty(executedQtyByItem[row.id] ?? 0)} / ${formatQty(resolvedCurrentPlannedQty(row))}`,
      ),
    ),
    { ...UNIT_COLUMN, label: grid.unit },
  ]
}
