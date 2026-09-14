import { requireManagementPage } from '@/lib/auth/require-management-page'
import { getPresetRows } from '@/lib/queries/presets'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PresetsDataTable } from '@/components/presets/presets-data-table'

export default async function PresetsPage() {
  await requireManagementPage()

  return (
    <PageWrapper title="Szablony kosztorysów">
      <PresetsDataTable data={await getPresetRows()} />
    </PageWrapper>
  )
}
