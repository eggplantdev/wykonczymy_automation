import { PROBLEM_CONDITIONS } from '@/lib/kosztorys/problem-conditions'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'

export type ChipRemovalT = 'condition' | 'problem' | 'sections' | 'search'

export type ActiveFilterChipT = {
  id: string
  label: string
  // Across the whole kosztorys, never over the survivors — a chip whose number counted what its own
  // filter left standing would move every time anything else was ticked.
  count?: number
  // built from the bare name rather than from `label`, whose
  // „Tylko:" prefix would read back as „Usuń: Tylko: …".
  removeLabel: string
  removal: ChipRemovalT
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  collapsedSectionCount: number
  search: string
  counts: ReadonlyMap<string, number>
}

export function activeFiltersModel({
  engagedIds,
  collapsedSectionCount,
  search,
  counts,
}: ArgsT): ActiveFilterChipT[] {
  const chips: ActiveFilterChipT[] = []

  for (const condition of ROW_CONDITIONS) {
    if (condition.kind !== 'filter' || !engagedIds.has(condition.id)) continue
    chips.push({
      id: condition.id,
      label: `Tylko: pozycje ${condition.label}`,
      removeLabel: `Przestań pokazywać tylko pozycje ${condition.label}`,
      count: counts.get(condition.id) ?? 0,
      removal: 'condition',
    })
  }

  for (const problem of PROBLEM_CONDITIONS) {
    if (!engagedIds.has(problem.id)) continue
    chips.push({
      id: problem.id,
      label: `Tylko: ${problem.noun.toLowerCase()} ${problem.fullLabel}`,
      removeLabel: `Przestań pokazywać tylko ${problem.noun.toLowerCase()} ${problem.fullLabel}`,
      count: counts.get(problem.id) ?? 0,
      removal: 'problem',
    })
  }

  if (collapsedSectionCount > 0) {
    chips.push({
      id: 'collapsed-sections',
      label: 'Zwinięte sekcje',
      removeLabel: 'Rozwiń wszystkie sekcje',
      count: collapsedSectionCount,
      removal: 'sections',
    })
  }

  if (search.trim() !== '') {
    chips.push({
      id: 'search',
      label: `Szukaj: „${search}"`,
      removeLabel: 'Wyczyść wyszukiwanie',
      removal: 'search',
    })
  }

  return chips
}
