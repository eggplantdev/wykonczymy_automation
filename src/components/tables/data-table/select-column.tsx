'use client'

import { createContext, use } from 'react'
import { Checkbox, checkedState } from '@/components/ui/checkbox'
import { useTranslation } from '@/hooks/use-translation'

export const SelectedIdsContext = createContext<ReadonlySet<number>>(new Set())

// Read from context rather than baked into the columns: `flexRender` mounts a `cell` function as a
// component, so columns rebuilt per click would remount every cell on the page.
export function SelectRowCell({
  id,
  label,
  onToggle,
}: {
  id: number
  label: string
  onToggle: (id: number) => void
}) {
  const selected = use(SelectedIdsContext)
  return (
    <Checkbox checked={selected.has(id)} onCheckedChange={() => onToggle(id)} aria-label={label} />
  )
}

export function SelectPageHeader({
  pageIds,
  onTogglePage,
}: {
  pageIds: number[]
  onTogglePage: (ids: number[]) => void
}) {
  const selected = use(SelectedIdsContext)
  const { t } = useTranslation('filters')
  return (
    <Checkbox
      checked={checkedState(pageIds.filter((id) => selected.has(id)).length, pageIds.length)}
      onCheckedChange={() => onTogglePage(pageIds)}
      aria-label={t('selectAllOnPage')}
    />
  )
}
