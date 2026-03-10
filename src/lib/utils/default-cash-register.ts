import type { ReferenceDataT } from '@/types/reference-data'

/**
 * Derives the user's default cash register ID from reference data.
 */
export function getUserDefaultCashRegisterId(referenceData: ReferenceDataT): number | undefined {
  return referenceData.workers.find((w) => w.id === referenceData.currentUserId)
    ?.defaultCashRegisterId
}

/**
 * Resolves which cash register to pre-select in forms.
 * Returns the default register ID if one exists, otherwise empty string.
 */
export function getDefaultCashRegister(referenceData: ReferenceDataT): string {
  const defaultCashRegisterId = getUserDefaultCashRegisterId(referenceData)
  if (defaultCashRegisterId !== undefined) return String(defaultCashRegisterId)
  return ''
}
