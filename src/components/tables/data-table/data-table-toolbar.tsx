'use client'

import { ControlGrid } from '@/components/ui/control-grid'
import {
  SearchFilterInput,
  SEARCH_FILTER_TOOLBAR_WIDTH,
} from '@/components/filters/search-filter-input'
import { cn } from '@/lib/utils/cn'

type ToolbarSearchT = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

type DataTableToolbarPropsT = {
  title?: React.ReactNode
  /** The search field, at the shared toolbar width. */
  search?: ToolbarSearchT
  filters?: React.ReactNode
  columns?: React.ReactNode
  /** Actions — create a row, export, refetch. */
  actions?: React.ReactNode
  className?: string
}

/**
 * The one toolbar every data table renders into. Slots, not children, because the order is the
 * contract: the search field holds the left edge, the column picker the right. Ten tables
 * hand-assembling a flat list each rediscovered that layout, and they disagreed — the picker reached
 * the edge only where it happened to be the last child, and landed mid-row everywhere else.
 */
export function DataTableToolbar({
  title,
  search,
  filters,
  columns,
  actions,
  className,
}: DataTableToolbarPropsT) {
  const hasLeft = Boolean(search || filters)
  const hasRight = Boolean(columns || actions)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {title && <h2 className="text-foreground w-full text-lg font-semibold">{title}</h2>}
      {hasLeft && (
        <ControlGrid className="sm:w-auto sm:flex-initial sm:items-center">
          {search && (
            <SearchFilterInput
              {...search}
              className={cn('col-span-2', SEARCH_FILTER_TOOLBAR_WIDTH)}
            />
          )}
          {filters}
        </ControlGrid>
      )}
      {/* The auto margin lives on the group, not on the picker inside it: this div is always the
          row's last child, so it always has the free space to float into — which the picker only had
          on the pages that happened to render it last. Below `sm` the row is wrapping, and spreading
          there would strand the group alone on the right of whatever line it landed on. */}
      {hasRight && (
        <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
          {actions}
          {columns}
        </ControlGrid>
      )}
    </div>
  )
}
