'use client'

import { Rows3 } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useFilterResetAction } from '@/components/kosztorys/editor/toolbar/menus/use-filter-reset-action'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { liftsToSections, offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'

// Ticked = expanded, so the values are always the full list of open sekcje — [] folds them all.
export function KosztorysSectionsMenu() {
  const {
    subtotals,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    setCollapsedSectionIds,
    foldableSectionIds,
    engagedConditionIds,
    globalDiscount,
    crewAxis,
    isTemplate,
  } = useKosztorysEditorContext()
  const resetAction = useFilterResetAction()

  const options = subtotals.map((s) => ({ value: String(s.sectionId), label: s.sectionName }))

  const expanded = subtotals
    .filter((s) => !storedCollapsedSectionIds.has(s.sectionId))
    .map((s) => String(s.sectionId))

  function onValuesChange(next: string[]) {
    // Collapse is stored positively, so the complement of the ticked set is what gets folded.
    const keptOpen = new Set(next)
    setCollapsedSectionIds(
      new Set(subtotals.filter((s) => !keptOpen.has(String(s.sectionId))).map((s) => s.sectionId)),
    )
  }

  const sectionToggles = offeredFilterConditions({
    engagedIds: engagedConditionIds,
    perItemDiscountInert: isGlobalDiscountActive(globalDiscount),
    crewAxis,
    isTemplate,
  })
    .filter(liftsToSections)
    .map((condition) => ({
      condition,
      sectionIds: foldableSectionIds.get(condition.id) ?? new Set<number>(),
    }))
    .filter(({ sectionIds }) => sectionIds.size > 0)
    .map(({ condition, sectionIds }) => {
      const isActive = (current: string[]) =>
        [...sectionIds].every((id) => current.includes(String(id)))

      return {
        label: `${condition.sectionLabel} (${sectionIds.size})`,
        isActive,
        select: (current: string[]) =>
          isActive(current)
            ? current.filter((v) => !sectionIds.has(Number(v)))
            : [...current, ...[...sectionIds].map(String).filter((v) => !current.includes(v))],
      }
    })

  return (
    <FilterMultiSelect
      values={expanded}
      onValuesChange={onValuesChange}
      options={options}
      label="Sekcje"
      triggerCount={collapsedSectionIds.size}
      icon={Rows3}
      searchable
      title="Co widać: sekcje"
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
      resetAction={resetAction}
      bulkLabels={{ select: 'Rozwiń wszystkie sekcje', deselect: 'Zwiń wszystkie sekcje' }}
      actionsHeading="Zwijanie"
      optionsHeading="Widoczne sekcje"
      optionToggles={sectionToggles}
    />
  )
}
