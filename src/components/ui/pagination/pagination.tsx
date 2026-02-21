import * as React from 'react'

import { cn } from '@/lib/cn'
import Icon from '../icons/icon'

// --- Styling primitives (no navigation logic) ---

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full flex-wrap justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLabelsT = {
  previous?: string
  next?: string
  goToPreviousPage?: string
  goToNextPage?: string
  page?: string
  morePages?: string
  paginationLabel?: string
}

type PaginationLinkPropsT = {
  isActive?: boolean
  isDisabled?: boolean
  children?: React.ReactNode
  className?: string
  'aria-label'?: string
}

function PaginationLink({ className, isActive, isDisabled, ...props }: PaginationLinkPropsT) {
  return (
    <span
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={isDisabled}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition-all duration-200 select-none',
        isActive && 'border-foreground text-foreground border',
        !isActive && !isDisabled && 'border-border text-foreground hover:bg-accent border',
        isDisabled && 'text-muted-foreground pointer-events-none cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

type PaginationPreviousPropsT = PaginationLinkPropsT & { label?: string }

function PaginationPrevious({
  className,
  label = 'Go to previous page',
  ...props
}: PaginationPreviousPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <Icon iconName="arrowLeft" className="size-4" />
    </PaginationLink>
  )
}

type PaginationNextPropsT = PaginationLinkPropsT & { label?: string }

function PaginationNext({ className, label = 'Go to next page', ...props }: PaginationNextPropsT) {
  return (
    <PaginationLink aria-label={label} className={cn('w-auto gap-1 px-3', className)} {...props}>
      <Icon iconName="arrowRight" className="size-4" />
    </PaginationLink>
  )
}

type PaginationEllipsisPropsT = React.ComponentProps<'span'> & { srLabel?: string }

function PaginationEllipsis({
  className,
  srLabel = 'More pages',
  ...props
}: PaginationEllipsisPropsT) {
  return (
    <PaginationLink
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('pointer-events-none w-auto gap-1 px-3', className)}
      {...props}
    >
      <Icon iconName="menuDots" className="size-4" />
      <span className="sr-only">{srLabel}</span>
    </PaginationLink>
  )
}

export type { PaginationLabelsT }
export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
