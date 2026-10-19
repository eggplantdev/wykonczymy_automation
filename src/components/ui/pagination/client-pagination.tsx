'use client'

import { PageNav } from '@/components/ui/pagination/page-nav'
import { PaginationBar } from '@/components/ui/pagination/pagination-bar'

type ClientPaginationPropsT = {
  totalDocs: number
  pageSize: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function ClientPagination({
  totalDocs,
  pageSize,
  currentPage,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: ClientPaginationPropsT) {
  return (
    <PaginationBar
      totalDocs={totalDocs}
      limit={pageSize}
      onLimitChange={onPageSizeChange}
      className="mt-0"
    >
      <PageNav
        currentPage={currentPage}
        totalPages={totalPages}
        renderPage={(target, isInert, children) => (
          <button type="button" disabled={isInert} onClick={() => onPageChange(target)}>
            {children}
          </button>
        )}
      />
    </PaginationBar>
  )
}
