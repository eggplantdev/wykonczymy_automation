'use client'

import { ListFilter } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useKosztorysFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu'

export function KosztorysFiltersMenu() {
  const { engagedConditionIds, toggleCondition, conditionCounts } = useKosztorysEditorContext()
  const { filters, resetAction } = useKosztorysFilterMenu()

  const workToggles = filters.map((condition) => ({
    id: condition.id,
    // The count is how many pozycje are in that state, not how many the row is currently showing —
    // a count of the survivors would be a count of itself and would jump on every click.
    label: `Pozycje ${condition.label} (${conditionCounts.get(condition.id) ?? 0})`,
    active: !engagedConditionIds.has(condition.id),
    onToggle: () => toggleCondition(condition.id),
  }))

  const triggerCount = workToggles.filter((toggle) => !toggle.active).length

  return (
    <FilterMultiSelect
      label="Filtry"
      triggerCount={triggerCount}
      icon={ListFilter}
      iconPosition="right"
      title="Co widać: pozycje"
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      contentClassName="w-80"
      resetAction={resetAction}
      toggles={workToggles}
      togglesHeading="Prace"
    />
  )
}
