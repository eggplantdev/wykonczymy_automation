import type { ActiveFiltersBarChipT } from '@/components/filters/active-filters-bar'
import { FILTER_NONE } from '@/components/filters/filter-multi-select'
import type { CatalogueConditionT } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'

export type CatalogueChipRemovalT = 'condition' | 'problem' | 'search' | 'category' | 'unit'

export type CatalogueActiveFilterChipT = ActiveFiltersBarChipT & { removal: CatalogueChipRemovalT }

type OptionT = { value: string; label: string }

type ArgsT = {
  conditions: readonly CatalogueConditionT[]
  engagedIds: ReadonlySet<string>
  counts: ReadonlyMap<string, number>
  search: string
  categories: { values: readonly string[]; options: readonly OptionT[] }
  units: { values: readonly string[]; options: readonly OptionT[] }
}

const pickedLabels = ({ values, options }: ArgsT['categories']) =>
  values
    .map((value) =>
      value === FILTER_NONE
        ? 'żadna'
        : (options.find((option) => option.value === value)?.label ?? value),
    )
    .join(', ')

// The editor's `activeFiltersModel` for the catalogue: every source that narrows the table, so the
// bar never reads „nothing filtered" while rows are missing.
export function catalogueActiveFiltersModel({
  conditions,
  engagedIds,
  counts,
  search,
  categories,
  units,
}: ArgsT): CatalogueActiveFilterChipT[] {
  const chips: CatalogueActiveFilterChipT[] = []

  for (const condition of conditions) {
    if (!engagedIds.has(condition.id)) continue
    const isProblem = condition.kind === 'problem'
    chips.push({
      id: condition.id,
      label: `${isProblem ? 'Tylko' : 'Ukryto'}: prace ${condition.label}`,
      removeLabel: isProblem
        ? `Przestań pokazywać tylko prace ${condition.label}`
        : `Pokaż z powrotem prace ${condition.label}`,
      count: counts.get(condition.id) ?? 0,
      removal: isProblem ? 'problem' : 'condition',
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

  if (categories.values.length > 0) {
    chips.push({
      id: 'category',
      label: `Kategoria: ${pickedLabels(categories)}`,
      removeLabel: 'Pokaż wszystkie kategorie',
      removal: 'category',
    })
  }

  if (units.values.length > 0) {
    chips.push({
      id: 'unit',
      label: `j.m.: ${pickedLabels(units)}`,
      removeLabel: 'Pokaż wszystkie j.m.',
      removal: 'unit',
    })
  }

  return chips
}
