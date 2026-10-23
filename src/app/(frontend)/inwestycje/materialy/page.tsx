import { requireManagementPage } from '@/lib/auth/require-management-page'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { MATERIALS, toMaterialRow } from '@/lib/materials/price-list'
import { MaterialsDataTable } from '@/components/investments/materials/materials-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function MaterialsPage() {
  await requireManagementPage()

  return (
    <PageWrapper title={PAGE_TITLES.materials}>
      <MaterialsDataTable data={MATERIALS.map(toMaterialRow)} />
    </PageWrapper>
  )
}
