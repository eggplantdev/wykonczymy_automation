import { FILTER_GROUPS } from '@/lib/kosztorys/filter-groups'
import { offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'

export type FilterToggleT = {
  id: string
  label: string
  // The heading this row belongs under. Carried per row rather than returned as nested groups: the
  // list is already ordered by category, so the menu only has to notice where the label changes — the
  // same shape `problemsMenuModel` hands its own menu.
  groupLabel: string
  // Ticked = visible, so a row is active while its filter is NOT engaged. The inverse of „Problemy",
  // where the tick means pressed — a filter hides what it matches, a problem keeps it.
  active: boolean
}

type ArgsT = {
  engagedIds: ReadonlySet<string>
  // Per condition id, how many pozycje are in that state across the whole dataset.
  counts: ReadonlyMap<string, number>
  perItemDiscountInert: boolean
}

/**
 * The „Filtry" arithmetic, away from the component: which zawężenia there are to offer, under which
 * heading, and which of them are still ticked. Extracted because this is the part worth testing and
 * the markup around it is not.
 *
 * A filter with nothing to match is absent rather than shown at zero — the list is read first as a
 * report of what the rozpiska contains, and a row that could only ever hide nothing buries the one
 * that would hide something.
 *
 * The ENGAGED one is the exception and stays at „(0)": it is hiding pozycje right now and its tick is
 * the only way back: dropping the row would leave the grid short with no control to restore it.
 *
 * Ordered by `FILTER_GROUPS` rather than by the registry, so the headings decide the order and a later
 * registry reshuffle cannot interleave two axes. The two agree today, and a spec pins that — the
 * active-filters bar reads registry order, and the bar and the menu are two readings of one set.
 */
export function filtersMenuModel({
  engagedIds,
  counts,
  perItemDiscountInert,
}: ArgsT): FilterToggleT[] {
  const offered = offeredFilterConditions(engagedIds, perItemDiscountInert)

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
        label: `Pozycje ${condition.label} (${count})`,
        active: !engagedIds.has(condition.id),
      })),
  )
}
