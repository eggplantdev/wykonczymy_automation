'use client'

import { ListFilter } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { useKosztorysFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysFiltersMenu() {
  const { toggles, clear } = useKosztorysFilterMenu()
  const { refreshView } = useKosztorysEditorContext()

  if (toggles.length === 0) return null

  return (
    <FilterMultiSelect
      label="Filtry"
      icon={ListFilter}
      title="Co widać: pozycje"
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
      toggles={toggles}
      onClearToggles={clear}
      onOpen={refreshView}
    />
  )
}
