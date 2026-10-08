import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import { getCatalogueUsage } from '@/lib/queries/catalogue-usage'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { WorkCatalogueDataTable } from '@/components/work-catalogue/work-catalogue-data-table'

export default async function WorkCataloguePage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const items = await getWorkCatalogue()
  const usage = await getCatalogueUsage(items)

  return (
    <PageWrapper title={PAGE_TITLES.workCatalog}>
      <WorkCatalogueDataTable data={items} usage={usage} />
    </PageWrapper>
  )
}
