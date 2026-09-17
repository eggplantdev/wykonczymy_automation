'use client'

import { Rows3 } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect, FILTER_NONE } from '@/components/filters/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { useKosztorysFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu'
import { liftsToSections } from '@/lib/kosztorys/row-conditions/queries'

// Reuses the transfers FilterMultiSelect, whose URL encoding is
// [] = all / [FILTER_NONE] = none / [ids] = those — bridged here to collapsedSectionIds.
export function KosztorysSectionsMenu() {
  const {
    subtotals,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    setCollapsedSectionIds,
    foldableSectionIds,
  } = useKosztorysEditorContext()
  const { filters, resetAction } = useKosztorysFilterMenu()

  const options = subtotals.map((s) => ({ value: String(s.sectionId), label: s.sectionName }))

  const expanded = subtotals
    .filter((s) => !storedCollapsedSectionIds.has(s.sectionId))
    .map((s) => String(s.sectionId))

  const values = expanded.length === 0 ? [FILTER_NONE] : expanded

  function onValuesChange(next: string[]) {
    // Collapse is stored positively, so the complement of the ticked set is what gets folded — a
    // section the menu never listed (added while it was open) is therefore left expanded.
    if (next.length === 0) return setCollapsedSectionIds(new Set())
    const keptOpen =
      next.length === 1 && next[0] === FILTER_NONE ? new Set<string>() : new Set(next)
    setCollapsedSectionIds(
      new Set(subtotals.filter((s) => !keptOpen.has(String(s.sectionId))).map((s) => s.sectionId)),
    )
  }

  const sectionToggles = filters
    .filter(liftsToSections)
    .map((condition) => ({
      condition,
      sectionIds: foldableSectionIds.get(condition.id) ?? new Set<number>(),
    }))
    // An axis that lifts no sekcja is left out entirely. Its row could only ever select the empty
    // set, so it was a live click that did nothing.
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
      values={values}
      onValuesChange={onValuesChange}
      options={options}
      label="Sekcje"
      triggerCount={collapsedSectionIds.size}
      icon={Rows3}
      iconPosition="right"
      searchable
      title="Co widać: sekcje"
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      contentClassName="w-80"
      resetAction={resetAction}
      bulkLabels={{ select: 'Rozwiń wszystkie sekcje', deselect: 'Zwiń wszystkie sekcje' }}
      actionsHeading="Zwijanie"
      optionsHeading="Widoczne sekcje"
      optionToggles={sectionToggles}
    />
  )
}
