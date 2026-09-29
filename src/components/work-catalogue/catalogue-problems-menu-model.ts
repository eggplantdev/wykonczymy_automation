import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'
import type { CatalogueConditionT } from '@/lib/kosztorys/work-catalogue/catalogue-conditions'

type ArgsT = {
  conditions: readonly CatalogueConditionT[]
  engagedIds: ReadonlySet<string>
  counts: ReadonlyMap<string, number>
}

// Same rules as the editor's `problemsMenuModel`: ticked = engaged, and an empty list hides the
// trigger — except the engaged problem, which stays at „(0)" so the narrowing it started can be undone.
export function catalogueProblemsMenuModel({
  conditions,
  engagedIds,
  counts,
}: ArgsT): DropdownCheckItemT[] {
  return conditions
    .filter((condition) => condition.kind === 'problem')
    .map((condition) => ({ condition, count: counts.get(condition.id) ?? 0 }))
    .filter(({ condition, count }) => count > 0 || engagedIds.has(condition.id))
    .map(({ condition, count }) => ({
      id: condition.id,
      groupLabel: condition.group,
      label: `Prace ${condition.label} (${count})`,
      active: engagedIds.has(condition.id),
    }))
}
