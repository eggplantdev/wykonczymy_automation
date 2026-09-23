'use client'

import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

/**
 * „Zresetuj filtry" as one button offered from two menus — „Filtry" and „Sekcje" — because it undoes
 * everything that hides pozycje, not the menu it was clicked from. Its own hook so neither menu has to
 * reach into the other's for it: „Sekcje" once called `useKosztorysFilterMenu` for this one field and
 * paid for the whole toggle list it never rendered.
 *
 * Disabled only when all three sources are clear; the „Problemy" menu offers its own, deliberately
 * narrower reset (see `kosztorys-problems-menu.tsx`).
 */
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
