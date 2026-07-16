'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { UrlPagination } from './url-pagination'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { SimpleSelect } from './simple-select'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import { cn } from '@/lib/utils/cn'

const LIMIT_OPTIONS = [20, 50, 100].map((n) => ({ value: String(n), label: n }))

type PaginationFooterPropsT = {
  paginationMeta: PaginationMetaT
  baseUrl: string
  className?: string
}

export function PaginationFooter({ paginationMeta, baseUrl, className }: PaginationFooterPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleLimitChange = (value: string) => {
    router.push(buildUrlWithParams(baseUrl, searchParams.toString(), { limit: value, page: '' }))
  }

  if (paginationMeta.totalPages <= 1 && paginationMeta.totalDocs === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        <p className="text-muted-foreground text-sm">{paginationMeta.totalDocs} wyników</p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Pokaż</span>
          <SimpleSelect
            value={String(paginationMeta.limit)}
            onValueChange={handleLimitChange}
            options={LIMIT_OPTIONS}
            className="h-8 w-20"
          />
        </div>
      </div>

      {paginationMeta.totalPages > 1 && (
        <UrlPagination
          currentPage={paginationMeta.currentPage}
          totalPages={paginationMeta.totalPages}
          baseUrl={baseUrl}
        />
      )}
    </div>
  )
}
