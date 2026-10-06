'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { UrlPagination } from './url-pagination'
import { PaginationBar } from './pagination/pagination-bar'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import type { PaginationMetaT } from '@/lib/utils/pagination'

type PaginationFooterPropsT = {
  paginationMeta: PaginationMetaT
  baseUrl: string
  className?: string
}

export function PaginationFooter({ paginationMeta, baseUrl, className }: PaginationFooterPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLimitChange = (limit: number) => {
    router.push(
      buildUrlWithParams(baseUrl, searchParams.toString(), { limit: String(limit), page: '' }),
    )
  }

  if (paginationMeta.totalPages <= 1 && paginationMeta.totalDocs === 0) return null

  return (
    <PaginationBar
      totalDocs={paginationMeta.totalDocs}
      limit={paginationMeta.limit}
      onLimitChange={handleLimitChange}
      className={className}
    >
      {paginationMeta.totalPages > 1 && (
        <UrlPagination
          currentPage={paginationMeta.currentPage}
          totalPages={paginationMeta.totalPages}
          baseUrl={baseUrl}
        />
      )}
    </PaginationBar>
  )
}
