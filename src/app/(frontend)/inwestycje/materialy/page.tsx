import { requireManagementPage } from '@/lib/auth/require-management-page'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { MATERIALS, PRICE_LIST_DATE, toMaterialRow } from '@/lib/materials/price-list'
import { MaterialsReport } from '@/components/investments/materials/materials-report'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function MaterialsPage() {
  await requireManagementPage()

  return (
    <PageWrapper title={PAGE_TITLES.materials}>
      <MaterialsReport rows={MATERIALS.map(toMaterialRow)} priceListDate={PRICE_LIST_DATE} />
    </PageWrapper>
  )
}
