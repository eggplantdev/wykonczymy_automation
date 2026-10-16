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
  entries: CostEntryT[]
}

/**
 * `performedAt` is normalised before comparing: the listing hands over raw stored timestamps, and
 * `'2026-07-31T00:00:00Z' <= '2026-07-31'` is false as a string
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
