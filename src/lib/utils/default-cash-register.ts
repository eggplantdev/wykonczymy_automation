import type { ReferenceDataT } from '@/types/reference-data'

/**
 * Derives the user's default cash register ID from reference data.
 * Only a kasa the pickers offer counts: when the default was trashed after the page loaded, the
 * trash cleared it server-side, but this `referenceData` predates that.
 */
export function getUserDefaultCashRegisterId(referenceData: ReferenceDataT): number | undefined {
  const defaultCashRegisterId = referenceData.workers.find(
    (w) => w.id === referenceData.currentUserId,
  )?.defaultCashRegisterId
  const isOffered = referenceData.cashRegisters.some((r) => r.id === defaultCashRegisterId)
  return isOffered ? defaultCashRegisterId : undefined
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
