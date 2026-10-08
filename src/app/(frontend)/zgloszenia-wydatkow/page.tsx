import { requireManagementPage } from '@/lib/auth/require-management-page'
import { fetchExpenseDraftsPage } from '@/lib/queries/worker-expense-drafts'
import { parseQueueFilters } from '@/lib/queries/queue-filters'
import { isExpenseDraftStatus } from '@/lib/constants/worker-expense-drafts'
import { parseExpenseDraftSort } from '@/lib/queries/expense-draft-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { parsePagination } from '@/lib/utils/pagination'
import { ExpenseDraftsDataTable } from '@/components/worker-expenses/expense-drafts-data-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import type { PagePropsT } from '@/types/page'

export default async function ExpenseDraftsPage({ searchParams }: PagePropsT) {
  const user = await requireManagementPage()
  const sp = await searchParams
  const [drafts, referenceDataBase] = await Promise.all([
    fetchExpenseDraftsPage(
      { ...parseQueueFilters(sp, isExpenseDraftStatus), duplicatesOnly: sp.duplicates === '1' },
      parsePagination(sp),
      parseExpenseDraftSort(sp),
    ),
    fetchReferenceData(),
  ])

  return (
    <PageWrapper title={PAGE_TITLES.expenseDrafts}>
      <ExpenseDraftsDataTable
        data={drafts.rows}
        paginationMeta={drafts.paginationMeta}
        investments={drafts.investments}
        workers={drafts.workers}
        referenceData={{ ...referenceDataBase, currentUserId: user.id, currentUserRole: user.role }}
      />
    </PageWrapper>
  )
}
