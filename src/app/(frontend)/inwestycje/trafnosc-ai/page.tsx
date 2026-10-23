import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { AI_ACCURACY_EXCLUDED_INVESTMENT_IDS } from '@/lib/constants/investment-ai-stage'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { fetchAiAccuracy } from '@/lib/queries/ai-accuracy'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { AiAccuracyReport } from '@/components/investments/ai-accuracy/ai-accuracy-report'
import { EmptyState } from '@/components/ui/empty-state'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function AiAccuracyPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [accuracy, refData] = await Promise.all([fetchAiAccuracy(), fetchReferenceData()])
  const excludedNames = refData.investments
    .filter((investment) => AI_ACCURACY_EXCLUDED_INVESTMENT_IDS.includes(investment.id))
    .map((investment) => investment.name)

  return (
    <PageWrapper title={PAGE_TITLES.aiAccuracy}>
      {accuracy ? (
        <AiAccuracyReport accuracy={accuracy} excludedNames={excludedNames} />
      ) : (
        <EmptyState
          title="Brak sprawdzonych kosztorysów AI"
          description="Wynik pojawi się, gdy właściciel sprawdzi pierwszy kosztorys przygotowany przez AI."
        />
      )}
    </PageWrapper>
  )
}
