import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import { FILTER_GROUPS } from '@/lib/kosztorys/filter-groups'
import { offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'
import { capitalize } from '@/lib/utils/capitalize'

export type FilterToggleT = {
  id: string
  label: string
  groupLabel: string
  // Ticked = the grid narrows to it.
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  counts: ReadonlyMap<string, number>
  rowCount: number
  perItemDiscountInert: boolean
  crewAxis: CrewAxisT
  isTemplate: boolean
}

/**
 * An option matching every pozycja, or none, would change nothing if ticked, so it is left off. The
 * ENGAGED one is the exception: it is narrowing the grid right now, and its row is the only way to
 * untick it.
 */
export function filtersMenuModel({
  engagedIds,
  counts,
  rowCount,
  perItemDiscountInert,
  crewAxis,
  isTemplate,
}: ArgsT): FilterToggleT[] {
  const offered = offeredFilterConditions({
    engagedIds,
    perItemDiscountInert,
    crewAxis,
    isTemplate,
  })

  return FILTER_GROUPS.flatMap((group) =>
    offered
      .filter((condition) => condition.filterGroup === group.id)
      // How many pozycje are in that state, not how many the row is currently showing — a count of
      // the survivors would be a count of itself and would jump on every click.
      .map((condition) => ({ condition, count: counts.get(condition.id) ?? 0 }))
      .filter(
        ({ condition, count }) => (count > 0 && count < rowCount) || engagedIds.has(condition.id),
      )
      .map(({ condition, count }) => ({
        id: condition.id,
        groupLabel: group.label,
        label: `${condition.menuLabel ?? capitalize(condition.label)} (${count})`,
        active: engagedIds.has(condition.id),
      })),
  )
}
