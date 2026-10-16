import {
  SCHEDULED_INSPECTION_TYPES,
  type ScheduledInspectionTypeT,
} from '@/lib/fleet/inspection-types'

/**
 * Unknown and non-scheduled values are dropped rather than trusted — an exemption on a type the UI cannot show
 * would be impossible to untick.
 */
export const parseVehicleExemptions = (raw: unknown): ScheduledInspectionTypeT[] => {
  if (!Array.isArray(raw)) return []

  return SCHEDULED_INSPECTION_TYPES.filter((type) => raw.includes(type))
}

export const isExempt = (exemptions: readonly ScheduledInspectionTypeT[], type: string): boolean =>
  exemptions.some((exempt) => exempt === type)
