import type { LanguageT } from '@/lib/i18n/languages'
import { getTranslations } from '@/lib/i18n/translations'
import { DESCRIPTION_COLUMN, UNIT_COLUMN, type PrintColumnT } from '@/lib/kosztorys/print/columns'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { escapeHtml } from '@/lib/utils/escape-html'

export function workerFormColumns(locale: LanguageT): PrintColumnT[] {
  const { grid, report } = getTranslations(locale)
  return [
    {
      key: 'ref',
      label: report.formNumber,
      colClass: 'c-unit',
      cellClass: 'ref',
      headerClass: '',
      cell: (row) => (row.ref === undefined ? '' : escapeHtml(formatFormRef(row.ref))),
    },
    { ...DESCRIPTION_COLUMN, label: grid.description },
    { ...UNIT_COLUMN, label: grid.unit },
    {
      key: 'executed',
      label: report.formExecuted,
      colClass: 'c-write',
      cellClass: 'write',
      headerClass: 'write',
      cell: () => '',
    },
  ]
}
