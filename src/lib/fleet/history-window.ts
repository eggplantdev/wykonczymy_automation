import { byInspectionType, type InspectionTypeT } from '@/lib/fleet/inspection-types'
import { isWithinRange, type DateRangeT } from '@/lib/utils/date-range'
import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

/**
 * Deliberately applied to entries that are ALREADY mapped: `kmSincePrevious` was measured against the
 * event below it across the whole history.
 */
export const narrowHistory = (
  historyByType: Record<InspectionTypeT, InspectionHistoryEntryT[]>,
  range: DateRangeT,
): Record<InspectionTypeT, InspectionHistoryEntryT[]> =>
  byInspectionType((type) =>
    historyByType[type].filter((entry) => isWithinRange(entry.performedAt, range)),
  )

export const emptyHistoryLabel = (noun: string, hiddenByWindow: boolean): string =>
  hiddenByWindow ? `Brak ${noun} w wybranym okresie` : `Brak ${noun}`
