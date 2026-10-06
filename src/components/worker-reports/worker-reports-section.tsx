import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
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
  const { t } = createTranslator(locale, 'workerReports')

  return (
    <CollapsibleSection
      title={t('title')}
      hint={t('hint')}
      storageKey="worker:workReports"
      withSeparator={false}
    >
      {reports.length === 0 ? (
        <Description>{t('empty')}</Description>
      ) : (
        <WorkerReportHistoryTable reports={reports} canOpenInKosztorys={canOpenInKosztorys} />
      )}
    </CollapsibleSection>
  )
}
