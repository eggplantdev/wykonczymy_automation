import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import { FILTER_GROUPS } from '@/lib/kosztorys/filter-groups'
import { offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'
import { capitalize } from '@/lib/utils/capitalize'

export type FilterToggleT = {
  id: string
  label: string
  groupLabel: string
  // Ticked = visible, so a row is active while its filter is NOT engaged.
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  counts: ReadonlyMap<string, number>
  perItemDiscountInert: boolean
  crewAxis: CrewAxisT
  isTemplate: boolean
}

/**
 * The ENGAGED one is the exception and stays at „(0)": it is hiding pozycje right now and its tick is
 * the only way back: dropping the row would leave the grid short with no control to restore it.
 */
export function filtersMenuModel({
  engagedIds,
  counts,
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
      .filter(({ condition, count }) => count > 0 || engagedIds.has(condition.id))
      .map(({ condition, count }) => ({
        id: condition.id,
        groupLabel: group.label,
        label: `${condition.menuLabel ?? capitalize(condition.label)} (${count})`,
        active: !engagedIds.has(condition.id),
      })),
  )
}
