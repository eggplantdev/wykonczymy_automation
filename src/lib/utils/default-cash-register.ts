import type { ReferenceDataT } from '@/types/reference-data'

/**
 * when the default was trashed after the page loaded, the trash cleared it server-side, but this
 * `referenceData` predates that.
 */
export function getUserDefaultCashRegisterId(referenceData: ReferenceDataT): number | undefined {
  const defaultCashRegisterId = referenceData.workers.find(
    (w) => w.id === referenceData.currentUserId,
  )?.defaultCashRegisterId
  const isOffered = referenceData.cashRegisters.some((r) => r.id === defaultCashRegisterId)
  return isOffered ? defaultCashRegisterId : undefined
}

export function getDefaultCashRegister(referenceData: ReferenceDataT): string {
  const defaultCashRegisterId = getUserDefaultCashRegisterId(referenceData)
  if (defaultCashRegisterId !== undefined) return String(defaultCashRegisterId)
  return ''
}
