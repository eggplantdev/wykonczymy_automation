import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import type { CatalogueConditionT } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'
import { capitalize } from '@/lib/utils/capitalize'

type ArgsT = {
  // Already ordered by group — the menu prints a heading wherever the group changes.
  conditions: readonly CatalogueConditionT[]
  engagedIds: ReadonlySet<string>
  // Over the whole catalogue, so a count never moves when search or Kategoria does.
  counts: ReadonlyMap<string, number>
}

// Same rules as the editor's `filtersMenuModel`: ticked = visible, and a filter with nothing to match
// is left off unless it is engaged — then its tick is the only way to bring the rows back.
export function catalogueFiltersMenuModel({
  conditions,
  engagedIds,
  counts,
}: ArgsT): DropdownCheckItemT[] {
  return conditions
    .filter((condition) => condition.kind === 'filter')
    .map((condition) => ({ condition, count: counts.get(condition.id) ?? 0 }))
    .filter(({ condition, count }) => count > 0 || engagedIds.has(condition.id))
    .map(({ condition, count }) => ({
      id: condition.id,
      groupLabel: condition.group,
      label: `${capitalize(condition.label)} (${count})`,
      active: !engagedIds.has(condition.id),
    }))
}
