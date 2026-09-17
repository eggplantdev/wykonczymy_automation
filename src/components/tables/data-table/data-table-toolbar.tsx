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
 * The one toolbar every data table renders into. Slots, not children: the order is the contract
 * (search on the left edge, column picker on the right), which ten tables hand-assembling a flat
 * list each got wrong in a different way.
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
      {/* Auto margin on the group, not the picker: this div is always the row's last child. Not below
          `sm`, where the row wraps and spreading would strand it alone on its line. */}
      {hasRight && (
        <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
          {actions}
          {columns}
        </ControlGrid>
      )}
    </div>
  )
}
