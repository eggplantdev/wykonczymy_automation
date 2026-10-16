'use client'

import { ControlGrid } from '@/components/ui/control-grid'
import {
  SearchFilterInput,
  SEARCH_FILTER_TOOLBAR_WIDTH,
} from '@/components/filters/search-filter-input'
import { cn } from '@/lib/utils/cn'
import { SECTION_TITLE_CLASS } from '@/components/ui/section-header'

type ToolbarSearchT = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

type DataTableToolbarPropsT = {
  title?: React.ReactNode
  search?: ToolbarSearchT
  filters?: React.ReactNode
  columns?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

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
      {title && <h2 className={cn('text-foreground w-full', SECTION_TITLE_CLASS)}>{title}</h2>}
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
      {/* Not below `sm`, where the row wraps and spreading would strand it alone on its line. */}
      {hasRight && (
        <ControlGrid className="sm:ml-auto sm:w-auto sm:flex-initial sm:items-center">
          {actions}
          {columns}
        </ControlGrid>
      )}
    </div>
  )
}
