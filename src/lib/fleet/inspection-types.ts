export const SCHEDULED_INSPECTION_TYPES = [
  'TECHNICAL',
  'INSURANCE',
  'OIL_CHANGE',
  'WARRANTY',
  'TYRES',
] as const

export const PERFORMED_INSPECTION_TYPES = [...SCHEDULED_INSPECTION_TYPES, 'SERVICE'] as const

export const INSPECTION_TYPES = [...PERFORMED_INSPECTION_TYPES, 'ODOMETER'] as const

export type ScheduledInspectionTypeT = (typeof SCHEDULED_INSPECTION_TYPES)[number]

export type PerformedInspectionTypeT = (typeof PERFORMED_INSPECTION_TYPES)[number]

export type InspectionTypeT = (typeof INSPECTION_TYPES)[number]

export const INSPECTION_TYPE_LABELS: Record<InspectionTypeT, { en: string; pl: string }> = {
  TECHNICAL: { en: 'Technical inspection', pl: 'Przegląd techniczny' },
  INSURANCE: { en: 'Insurance', pl: 'OC' },
  OIL_CHANGE: { en: 'Oil change', pl: 'Wymiana oleju' },
  WARRANTY: { en: 'Warranty inspection', pl: 'Przegląd gwarancyjny' },
  TYRES: { en: 'Tyre change', pl: 'Wymiana opon' },
  SERVICE: { en: 'Service', pl: 'Serwis' },
  ODOMETER: { en: 'Odometer reading', pl: 'Odczyt licznika' },
}

/**
 * The form reads the `null` to decide not to prefill; it must never fall back to a default.
 */
export const INSPECTION_INTERVAL_MONTHS: Record<InspectionTypeT, number | null> = {
  TECHNICAL: 12,
  INSURANCE: 12,
  OIL_CHANGE: 12,
  WARRANTY: 24,
  TYRES: null,
  SERVICE: null,
  ODOMETER: null,
}

export const byInspectionType = <T>(valueOf: (type: InspectionTypeT) => T) =>
  Object.fromEntries(INSPECTION_TYPES.map((type) => [type, valueOf(type)])) as Record<
    InspectionTypeT,
    T
  >
