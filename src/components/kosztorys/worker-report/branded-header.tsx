'use client'

import { BrandLogo } from '@/components/ui/brand-logo'
import { LanguageSwitcher } from '@/components/kosztorys/worker-report/language-switcher'
import type { WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import { useTranslation } from '@/lib/i18n/use-translation'

// The same mark as the investor and worker links, so a worker opening this from a text message
// knows whose page it is. The switcher lives here so a notice offers it too.
export function BrandedHeader({
  data,
}: {
  data: Pick<WorkerReportFormDataT, 'investmentName' | 'workerName'>
}) {
  const { t } = useTranslation('report')
  return (
    <header className="border-border flex items-center gap-4 border-b px-4 py-3 sm:py-5">
      <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold">{t('title')}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-sm">
          <dt className="text-muted-foreground">{t('investment')}</dt>
          <dd className="min-w-0 truncate">{data.investmentName}</dd>
          <dt className="text-muted-foreground">{t('worker')}</dt>
          <dd className="min-w-0 truncate">{data.workerName}</dd>
        </dl>
      </div>
      <div className="shrink-0 self-start">
        <LanguageSwitcher />
      </div>
    </header>
  )
}
