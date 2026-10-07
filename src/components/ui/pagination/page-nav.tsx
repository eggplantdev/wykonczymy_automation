'use client'

import type { ReactNode } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination'
import { getWindowedPages } from './get-windowed-pages'
import { useTranslation } from '@/hooks/use-translation'

const JUMP_SIZE = 5

type PageNavPropsT = {
  currentPage: number
  totalPages: number
  /** Wraps one control. `isInert` = it would go nowhere. */
  renderPage: (page: number, isInert: boolean, children: ReactNode) => ReactNode
}

export function PageNav({ currentPage, totalPages, renderPage }: PageNavPropsT) {
  const { t } = useTranslation('filters')

  if (totalPages <= 1) return null

  const visiblePages = getWindowedPages(currentPage, totalPages)
  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages

  return (
    <Pagination aria-label={t('pagination')}>
      <PaginationContent>
        {!visiblePages.includes(1) && (
          <PaginationItem>
            {renderPage(1, false, <PaginationLink aria-label={t('firstPage')}>1</PaginationLink>)}
          </PaginationItem>
        )}

        <PaginationItem>
          {renderPage(
            Math.max(1, currentPage - JUMP_SIZE),
            isFirstPage,
            <PaginationPrevious
              isDisabled={isFirstPage}
              label={t('jumpBack', { count: JUMP_SIZE })}
            />,
          )}
        </PaginationItem>

        {visiblePages.map((page) => (
          <PaginationItem key={page}>
            {renderPage(
              page,
              page === currentPage,
              <PaginationLink isActive={page === currentPage} aria-label={t('goToPage', { page })}>
                {page}
              </PaginationLink>,
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          {renderPage(
            Math.min(totalPages, currentPage + JUMP_SIZE),
            isLastPage,
            <PaginationNext
              isDisabled={isLastPage}
              label={t('jumpForward', { count: JUMP_SIZE })}
            />,
          )}
        </PaginationItem>

        {!visiblePages.includes(totalPages) && (
          <PaginationItem>
            {renderPage(
              totalPages,
              false,
              <PaginationLink aria-label={t('lastPage')}>{totalPages}</PaginationLink>,
            )}
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
