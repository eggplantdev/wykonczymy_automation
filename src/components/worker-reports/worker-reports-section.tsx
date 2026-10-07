import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { WorkerReportHistoryTable } from '@/components/worker-reports/worker-report-history-table'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import type { LanguageT } from '@/lib/i18n/languages'
import { createTranslator } from '@/lib/i18n/translations'

type PropsT = {
  reports: ReportListRowT[]
  canOpenInKosztorys: boolean
  locale: LanguageT
}

export function WorkerReportsSection({ reports, canOpenInKosztorys, locale }: PropsT) {
  if (reports.length === 0) return null
  const { t } = createTranslator(locale, 'workerReports')

  return (
    <CollapsibleSection
      title={t('title')}
      hint={t('hint')}
      storageKey="worker:workReports"
      defaultOpen={false}
      withSeparator={false}
    >
      <WorkerReportHistoryTable reports={reports} canOpenInKosztorys={canOpenInKosztorys} />
    </CollapsibleSection>
  )
}
