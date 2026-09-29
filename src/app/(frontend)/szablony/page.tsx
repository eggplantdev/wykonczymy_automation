import { requireManagementPage } from '@/lib/auth/require-management-page'
import { getPresetRows } from '@/lib/queries/presets'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { PresetsDataTable } from '@/components/presets/presets-data-table'

export default async function PresetsPage() {
  await requireManagementPage()

  return (
    <PageWrapper title={PAGE_TITLES.templates}>
      <PresetsDataTable data={await getPresetRows()} />
    </PageWrapper>
  )
}
