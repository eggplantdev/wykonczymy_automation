import { requireManagementPage } from '@/lib/auth/require-management-page'
import { listAllReports } from '@/lib/queries/worker-reports'
import { WorkerReportsDataTable } from '@/components/worker-reports/worker-reports-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function WorkerReportsPage() {
  await requireManagementPage()
  const reports = await listAllReports()

  return (
    <PageWrapper title={PAGE_TITLES.workerReports}>
      <Description>
        Na górze zgłoszenia czekające na decyzję, niżej rozpatrzone — w nich też można jeszcze
        przyjąć odrzucone pozycje. Wiersz otwiera rozpiskę inwestycji z tym zgłoszeniem.
      </Description>
      <WorkerReportsDataTable data={reports} />
    </PageWrapper>
  )
}
