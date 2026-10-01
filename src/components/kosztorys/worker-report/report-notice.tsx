'use client'

import type { ReportNoticeKeyT } from '@/lib/kosztorys/worker-report/refusals'
import { useTranslation } from '@/hooks/use-translation'

export function ReportNotice({ messageKey }: { messageKey: ReportNoticeKeyT }) {
  const { t } = useTranslation('notices')
  return <p className="px-4 py-10 text-sm">{t(messageKey)}</p>
}
