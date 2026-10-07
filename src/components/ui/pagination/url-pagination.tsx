'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageNav } from './page-nav'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { cn } from '@/lib/utils/cn'

type UrlPaginationPropsT = {
  currentPage: number
  totalPages: number
  baseUrl: string
}

export function UrlPagination({ baseUrl, ...navProps }: UrlPaginationPropsT) {
  const searchParams = useSearchParams()

  const buildPageUrl = (page: number) =>
    buildUrlWithParams(baseUrl, searchParams.toString(), {
      page: page > 1 ? String(page) : '',
    })

  return (
    <PageNav
      {...navProps}
      renderPage={(page, isInert, children) => (
        <Link
          className={cn(isInert && 'pointer-events-none')}
          href={buildPageUrl(page)}
          scroll={false}
        >
          {children}
        </Link>
      )}
    />
  )
}
