import { toWarsawDay, type DayT } from '@/lib/utils/days'
import {
  PERFORMED_INSPECTION_TYPES,
  type PerformedInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import type { InspectionEventT, VehicleFlagsT } from '@/lib/fleet/types'

const isDay = (value: unknown): value is DayT =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * Unknown keys and non-day values are dropped rather than
 * trusted: a flag on a type that no longer exists would be invisible in the UI and unclearable.
 */
export const parseVehicleFlags = (raw: unknown): VehicleFlagsT => {
  if (typeof raw !== 'object' || raw === null) return {}

  const source = raw as Record<string, unknown>

  return Object.fromEntries(
    PERFORMED_INSPECTION_TYPES.filter((type) => isDay(source[type])).map((type) => [
      type,
      source[type],
    ]),
  )
}

/**
 * Which marks still stand. A mark is retired by an inspection of its type performed within
 * `[flaggedAt, today]` — so recording the work clears the alarm by itself
 */
export const activeFlags = (
  flags: VehicleFlagsT,
  events: readonly InspectionEventT[],
  today: DayT,
): PerformedInspectionTypeT[] =>
  PERFORMED_INSPECTION_TYPES.filter((type) => {
    const flaggedAt = flags[type]
    if (!flaggedAt) return false

    return !events.some((event) => {
      if (event.type !== type) return false

      const performedOn = toWarsawDay(event.performedAt)

      return performedOn >= flaggedAt && performedOn <= today
    })
  })

/**
 * A type that is already active keeps its original day — re-saving the form must not restart its
 * clock.
 */
export const nextFlags = ({
  current,
  active,
  selected,
  today,
}: {
  current: VehicleFlagsT
  active: readonly PerformedInspectionTypeT[]
  selected: readonly PerformedInspectionTypeT[]
  today: DayT
}): VehicleFlagsT =>
  Object.fromEntries(
    PERFORMED_INSPECTION_TYPES.filter((type) => selected.includes(type)).map((type) => [
      type,
      active.includes(type) ? (current[type] ?? today) : today,
    ]),
  )
