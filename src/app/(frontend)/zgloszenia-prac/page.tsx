import { requireManagementPage } from '@/lib/auth/require-management-page'
import { listAllPendingReports } from '@/lib/queries/worker-reports'
import { PendingWorkReportsDataTable } from '@/components/work-reports/pending-work-reports-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function WorkReportsPage() {
  await requireManagementPage()
  const reports = await listAllPendingReports()

  return (
    <PageWrapper title={PAGE_TITLES.workReports}>
      <Description>
        Zgłoszenia czekające na decyzję. Wiersz otwiera rozpiskę inwestycji z tym zgłoszeniem.
      </Description>
      <PendingWorkReportsDataTable data={reports} />
    </PageWrapper>
  )
}
