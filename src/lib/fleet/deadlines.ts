import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import type { InspectionEventT } from '@/lib/fleet/types'

const byPerformedAtDesc = (a: InspectionEventT, b: InspectionEventT) =>
  b.performedAt.localeCompare(a.performedAt)

/**
 * "Current" is the newest event **by `performedAt`**, not by due date: a backdated correction entered
 * late must not become the current deadline.
 */
export const latestByType = <T extends InspectionEventT>(
  events: readonly T[],
): Record<InspectionTypeT, T | null> => {
  const newestFirst = [...events].sort(byPerformedAtDesc)

  return byInspectionType((type) => newestFirst.find((event) => event.type === type) ?? null)
}

export const latestOdometerReading = (events: readonly InspectionEventT[]): number | null =>
  [...events].sort(byPerformedAtDesc).find((candidate) => candidate.odometer != null)?.odometer ??
  null

export const kmSinceOilChange = (events: readonly InspectionEventT[]): number | null => {
  const lastOilChange = latestByType(events).OIL_CHANGE
  const latest = latestOdometerReading(events)

  return latest != null && lastOilChange?.odometer != null ? latest - lastOilChange.odometer : null
}
