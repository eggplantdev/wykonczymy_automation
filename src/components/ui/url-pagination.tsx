'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { PageNav } from './pagination/page-nav'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { cn } from '@/lib/utils/cn'

type UrlPaginationPropsT = {
  currentPage: number
  totalPages: number
  baseUrl: string
  onNavigate?: (href: string) => void
  className?: string
  jumpSize?: number
}

export function UrlPagination({ baseUrl, onNavigate, ...navProps }: UrlPaginationPropsT) {
  const searchParams = useSearchParams()

  const buildPageUrl = (page: number) =>
    buildUrlWithParams(baseUrl, searchParams.toString(), {
      page: page > 1 ? String(page) : '',
    })

  function handleClick(e: React.MouseEvent, href: string) {
    if (!onNavigate) return
    e.preventDefault()
    onNavigate(href)
  }

  return (
    <PageNav
      {...navProps}
      renderPage={(page, isInert, children) => {
        const href = buildPageUrl(page)
        return (
          <Link
            className={cn(isInert && 'pointer-events-none')}
            href={href}
            scroll={false}
            onClick={(e) => handleClick(e, href)}
          >
            {children}
          </Link>
        )
      }}
    />
  )
}
