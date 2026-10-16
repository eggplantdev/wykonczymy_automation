import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import type { CatalogueConditionT } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'
import { capitalize } from '@/lib/utils/capitalize'

type ArgsT = {
  // Already ordered by group — the menu prints a heading wherever the group changes.
  conditions: readonly CatalogueConditionT[]
  engagedIds: ReadonlySet<string>
  // Over the whole catalogue, so a count never moves when search or Kategoria does.
  counts: ReadonlyMap<string, number>
  rowCount: number
}

// Ticked = the table narrows to it. A filter matching no praca or every praca would narrow nothing,
// so it is left off unless it is engaged — then its tick is the only way to bring the rows back.
export function catalogueFiltersMenuModel({
  conditions,
  engagedIds,
  counts,
  rowCount,
}: ArgsT): DropdownCheckItemT[] {
  return conditions
    .filter((condition) => condition.kind === 'filter')
    .map((condition) => ({ condition, count: counts.get(condition.id) ?? 0 }))
    .filter(
      ({ condition, count }) => (count > 0 && count < rowCount) || engagedIds.has(condition.id),
    )
    .map(({ condition, count }) => ({
      id: condition.id,
      groupLabel: condition.group,
      label: `${condition.menuLabel ?? capitalize(condition.label)} (${count})`,
      active: engagedIds.has(condition.id),
    }))
}
