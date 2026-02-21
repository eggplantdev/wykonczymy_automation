'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from './pagination/pagination'
import { getWindowedPages } from './pagination/get-windowed-pages'
import { buildUrlWithParams } from '@/lib/build-url-with-params'
import { cn } from '@/lib/cn'

type UrlPaginationPropsT = {
  currentPage: number
  totalPages: number
  baseUrl: string
  onNavigate?: (href: string) => void
  className?: string
  jumpSize?: number
}

export function UrlPagination({
  currentPage,
  totalPages,
  baseUrl,
  onNavigate,
  className,
  jumpSize = 5,
}: UrlPaginationPropsT) {
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  const buildPageUrl = (page: number) =>
    buildUrlWithParams(baseUrl, searchParams.toString(), {
      page: page > 1 ? String(page) : '',
    })

  function handleClick(e: React.MouseEvent, href: string) {
    if (!onNavigate) return
    e.preventDefault()
    onNavigate(href)
  }

  const visiblePages = getWindowedPages(currentPage, totalPages)
  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages
  const prevJumpPage = Math.max(1, currentPage - jumpSize)
  const nextJumpPage = Math.min(totalPages, currentPage + jumpSize)
  const showFirstPage = !visiblePages.includes(1)
  const showLastPage = !visiblePages.includes(totalPages)

  return (
    <Pagination className={className} aria-label="Nawigacja po stronach">
      <PaginationContent>
        {showFirstPage && (
          <PaginationItem>
            <Link
              href={buildPageUrl(1)}
              scroll={false}
              onClick={(e) => handleClick(e, buildPageUrl(1))}
            >
              <PaginationLink aria-label="Pierwsza strona">1</PaginationLink>
            </Link>
          </PaginationItem>
        )}

        <PaginationItem>
          <Link
            className={cn(isFirstPage && 'pointer-events-none')}
            href={buildPageUrl(prevJumpPage)}
            scroll={false}
            onClick={(e) => handleClick(e, buildPageUrl(prevJumpPage))}
          >
            <PaginationPrevious isDisabled={isFirstPage} label={`Cofnij ${jumpSize} stron`} />
          </Link>
        </PaginationItem>

        {visiblePages.map((page) => {
          const href = buildPageUrl(page)
          return (
            <PaginationItem key={page}>
              <Link
                className={cn(page === currentPage && 'pointer-events-none')}
                href={href}
                scroll={false}
                onClick={(e) => handleClick(e, href)}
              >
                <PaginationLink
                  isActive={page === currentPage}
                  aria-label={`Przejdź do strony ${page}`}
                >
                  {page}
                </PaginationLink>
              </Link>
            </PaginationItem>
          )
        })}

        <PaginationItem>
          <Link
            className={cn(isLastPage && 'pointer-events-none')}
            href={buildPageUrl(nextJumpPage)}
            scroll={false}
            onClick={(e) => handleClick(e, buildPageUrl(nextJumpPage))}
          >
            <PaginationNext isDisabled={isLastPage} label={`Przeskocz ${jumpSize} stron`} />
          </Link>
        </PaginationItem>

        {showLastPage && (
          <PaginationItem>
            <Link
              href={buildPageUrl(totalPages)}
              scroll={false}
              onClick={(e) => handleClick(e, buildPageUrl(totalPages))}
            >
              <PaginationLink aria-label="Ostatnia strona">{totalPages}</PaginationLink>
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
