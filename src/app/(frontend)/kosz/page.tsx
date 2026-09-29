import { requireManagementPage } from '@/lib/auth/require-management-page'
import { getTrashedInvestments } from '@/lib/queries/trash'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { TrashContents } from '@/components/trash/trash-contents'

export default async function TrashPage() {
  await requireManagementPage()

  return (
    <PageWrapper title={PAGE_TITLES.trash}>
      <TrashContents rows={await getTrashedInvestments()} />
    </PageWrapper>
  )
}
