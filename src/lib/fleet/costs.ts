import { toWarsawDay } from '@/lib/utils/days'
import { sumKnown } from '@/lib/utils/sum-known'
import { PERFORMED_INSPECTION_TYPES, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { ALL_TIME, isWithinRange, type DateRangeT } from '@/lib/utils/date-range'
import { groupInOrder } from '@/lib/utils/group-in-order'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

export type TypeCostT = {
  type: InspectionTypeT
  count: number
  total: number | null
}

export type CostEntryT = {
  id: number
  type: InspectionTypeT
  performedAt: string
  cost: number | null
}

export type VehicleCostsT = {
  byType: TypeCostT[]
  total: number | null
  /** Every entry, newest first — the itemisation behind the totals. */
  entries: CostEntryT[]
}

/**
 * What a set of inspections cost inside a window. The one implementation both the vehicle card and
 * the fleet listing call, so the same car cannot show two different totals on two screens.
 *
 * `performedAt` is normalised before comparing: the listing hands over raw stored timestamps, and
 * `'2026-07-31T00:00:00Z' <= '2026-07-31'` is false as a string — that przegląd falls on the
 * window's last Warsaw day, yet the raw compare would drop it.
 *
 * An unknown cost is skipped, not read as zero — see `sumKnown`, which every cost surface shares so
 * a screen cannot decide for itself what „no price" means.
 */
export const totalCost = (
  entries: readonly { performedAt: string; cost: number | null }[],
  range: DateRangeT,
): number | null =>
  sumKnown(
    entries
      .filter((entry) => isWithinRange(toWarsawDay(entry.performedAt), range))
      .map((entry) => entry.cost),
  )

/**
 * What the car has cost so far, derived from the history already on the page — no second query.
 *
 * A type with no inspection at all is left OUT rather than shown as 0 zł: „we have never done this"
 * is not the claim „it was free", and a row of zeroes reads as the latter. An event whose cost is
 * unknown still counts towards its type's `count` — it happened — but not towards its `total`,
 * which is `null` for a type whose every entry is priceless in the literal sense.
 */
export const summariseCosts = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
): VehicleCostsT => {
  // PERFORMED_ rather than every type: a meter reading is not work anybody was billed for, so an
  // ODOMETER row would open a „Odczyt licznika | 1 | —" cost bucket and inflate the „Razem" count.
  const costed = PERFORMED_INSPECTION_TYPES.flatMap((type) =>
    historyByType[type].map((entry) => ({
      id: entry.id,
      type,
      performedAt: entry.performedAt,
      cost: entry.cost,
    })),
  )

  const grouped = groupInOrder(costed, (entry) => entry.type)

  // Iterating the type list rather than the Map's keys keeps the table in the domain's order rather
  // than in whichever type happened to be serviced first.
  const byType = PERFORMED_INSPECTION_TYPES.flatMap((type) => {
    const ofType = grouped.get(type)
    if (!ofType) return []

    return [{ type, count: ofType.length, total: totalCost(ofType, ALL_TIME) }]
  })

  return {
    byType,
    total: totalCost(costed, ALL_TIME),
    entries: costed.sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  }
}
