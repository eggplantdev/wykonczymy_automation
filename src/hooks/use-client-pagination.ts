'use client'

import { useState } from 'react'

const DEFAULT_PAGE_SIZE = 10

// Page and limit stay in state: on a page that also pages transfers through the URL, two URL-driven
// tables would fight over `page` / `limit`.
export function useClientPagination<T>(rows: T[]) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const totalPages = Math.ceil(rows.length / pageSize)
  // A delete or a refresh can shrink the list under the current page.
  const currentPage = Math.min(page, Math.max(1, totalPages))

  function narrow(apply: () => void) {
    apply()
    setPage(1)
  }

  return {
    pageRows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    narrow,
    setPage,
    bar: {
      totalDocs: rows.length,
      pageSize,
      currentPage,
      totalPages,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => narrow(() => setPageSize(size)),
    },
  }
}
