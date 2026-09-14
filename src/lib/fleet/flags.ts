import { toWarsawDay, type DayT } from '@/lib/utils/days'
import {
  PERFORMED_INSPECTION_TYPES,
  type PerformedInspectionTypeT,
} from '@/lib/fleet/inspection-types'
import type { InspectionEventT, VehicleFlagsT } from '@/lib/fleet/types'

const isDay = (value: unknown): value is DayT =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/**
 * The column is `jsonb`, so what comes back is whatever was last written — including `null` from
 * every vehicle that predates the feature. Unknown keys and non-day values are dropped rather than
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
 * `[flaggedAt, today]` — so recording the work clears the alarm by itself, exactly as a new event
 * retires the old deadline (see `deadlines.ts`), and no write-back is needed on the inspection path.
 *
 * Both ends of that window are load-bearing. The lower one makes backfilling safe: entering a service
 * from last year cannot silence a mark made today. The upper one keeps a FUTURE-dated event from
 * doing it — a booked appointment is work that has not happened, and the mark is precisely the thing
 * saying it still needs to.
 *
 * It is INCLUSIVE at both ends, and that costs something: a day has no clock, so a mark made hours
 * after the work was recorded is retired by it on sight and the tick reads as a no-op. Same-day
 * clearing is the common case and an exclusive bound would break it, so the ambiguity is paid here
 * rather than there — the checkbox unticking itself on the round-trip is what makes it visible.
 *
 * Returned in PERFORMED_INSPECTION_TYPES order, never the stored object's, so the badges keep the domain's
 * order regardless of which type happened to be flagged first.
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
 * The map to persist for a newly ticked set.
 *
 * A type that is already active keeps its original day — re-saving the form must not restart its
 * clock. This is what the `active` argument exists for: a mark already retired by an inspection still
 * has its old day sitting in the map, so „keep whatever is stored" would write back a day the history
 * already covers and the tick would do nothing.
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
