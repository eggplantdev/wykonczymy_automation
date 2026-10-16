'use client'

import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function useFilterResetAction(): {
  label: string
  onReset: () => void
  disabled: boolean
} {
  const { engagedConditionIds, collapsedSectionIds, search, resetFilters } =
    useKosztorysEditorContext()

  return {
    label: 'Zresetuj filtry',
    onReset: resetFilters,
    disabled:
      engagedConditionIds.size === 0 && collapsedSectionIds.size === 0 && search.trim() === '',
  }
}
