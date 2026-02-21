'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { UrlPagination } from './url-pagination'
import { buildUrlWithParams } from '@/lib/build-url-with-params'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import type { PaginationMetaT } from '@/lib/pagination'
import { cn } from '../../lib/cn'

const LIMIT_OPTIONS = [20, 50, 100] as const

type PaginationFooterPropsT = {
  readonly paginationMeta: PaginationMetaT
  readonly baseUrl: string
  readonly className?: string
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
          <Select value={String(paginationMeta.limit)} onValueChange={handleLimitChange}>
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
