'use client'

import { useState } from 'react'
import { ListFilter } from 'lucide-react'
import { FilterMultiSelect, FILTER_NONE } from '@/components/transfers/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

// Section filter reusing the transfers FilterMultiSelect. The hook models the selection as
// Set<number> | null (null = all, empty Set = none, Set = those); FilterMultiSelect speaks the URL
// encoding [] = all / [FILTER_NONE] = none / [ids] = those, so this bridges the two.
export function KosztorysSectionFilterMenu() {
  const { subtotals, shownSectionIds, setShownSectionIds } = useKosztorysEditorContext()
  const [hideEmpty, setHideEmpty] = useState(false)

  // "Empty" = no executed work yet (net === 0), not "no positions" — every section always has at
  // least one item (an empty-of-items section is cascade-deleted, see use-kosztorys-editor.ts).
  const options = subtotals
    .filter((s) => !hideEmpty || s.net > 0)
    .map((s) => ({ value: String(s.sectionId), label: s.sectionName }))

  const values =
    shownSectionIds === null
      ? []
      : shownSectionIds.size === 0
        ? [FILTER_NONE]
        : [...shownSectionIds].map(String)

  function onValuesChange(next: string[]) {
    if (next.length === 0) setShownSectionIds(null)
    else if (next.length === 1 && next[0] === FILTER_NONE) setShownSectionIds(new Set())
    else setShownSectionIds(new Set(next.map(Number)))
  }

  return (
    <FilterMultiSelect
      values={values}
      onValuesChange={onValuesChange}
      options={options}
      label="Widok sekcji"
      icon={ListFilter}
      searchable
      title="Filtruj sekcje"
      triggerClassName="w-fit min-w-0"
      extraToggle={{
        label: 'Ukryj puste sekcje',
        checked: hideEmpty,
        onToggle: () => setHideEmpty((v) => !v),
      }}
    />
  )
}
