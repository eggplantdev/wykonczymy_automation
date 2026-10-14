import { requireManagementPage } from '@/lib/auth/require-management-page'
import {
  fetchExpenseDraftsPage,
  fetchPendingExpenseDrafts,
} from '@/lib/queries/worker-expense-drafts'
import { parseQueueFilters } from '@/lib/queries/queue-filters'
import { isExpenseDraftStatus, OPEN_DRAFT_PARAM } from '@/lib/constants/worker-expense-drafts'
import { parseExpenseDraftSort } from '@/lib/queries/expense-draft-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { parsePagination } from '@/lib/utils/pagination'
import { parseIdParam } from '@/lib/utils/parse-id-param'
import { ExpenseDraftsDataTable } from '@/components/worker-expenses/expense-drafts-data-table'
import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import type { PagePropsT } from '@/types/page'

export default async function ExpenseDraftsPage({ searchParams }: PagePropsT) {
  const user = await requireManagementPage()
  const sp = await searchParams
  const [drafts, pendingDrafts, referenceDataBase] = await Promise.all([
    fetchExpenseDraftsPage(
      { ...parseQueueFilters(sp, isExpenseDraftStatus), duplicatesOnly: sp.duplicates === '1' },
      parsePagination(sp),
      parseExpenseDraftSort(sp),
    ),
    fetchPendingExpenseDrafts(),
    fetchReferenceData(),
  ])

  const referenceData = { ...referenceDataBase, currentUserId: user.id, currentUserRole: user.role }

  return (
    <PageWrapper title={PAGE_TITLES.expenseDrafts}>
      <PendingExpenseDrafts
        drafts={pendingDrafts}
        referenceData={referenceData}
        storageKey="expense-drafts-page:pending"
        openDraftId={parseIdParam(sp[OPEN_DRAFT_PARAM])}
      />
      <ExpenseDraftsDataTable
        data={drafts.rows}
        paginationMeta={drafts.paginationMeta}
        investments={drafts.investments}
        workers={drafts.workers}
        referenceData={referenceData}
      />
    </PageWrapper>
  )
}
