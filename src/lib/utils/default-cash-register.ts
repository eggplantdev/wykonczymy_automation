import type { ReferenceDataT } from '@/types/reference-data'

/**
 * Derives the user's owned register IDs from reference data.
 * Returns `undefined` for ADMIN (no restriction).
 */
export function getUserCashRegisterIds(referenceData: ReferenceDataT): number[] | undefined {
  if (referenceData.currentUserRole === 'ADMIN') return undefined
  return referenceData.cashRegisters
    .filter((cr) => cr.ownerId === referenceData.currentUserId)
    .map((cr) => cr.id)
}

/**
 * Derives the user's default cash register ID from reference data.
 */
export function getUserDefaultCashRegisterId(referenceData: ReferenceDataT): number | undefined {
  return referenceData.workers.find((w) => w.id === referenceData.currentUserId)
    ?.defaultCashRegisterId
}

/**
 * Resolves which cash register to pre-select in forms.
 *
 * Priority:
 * 1. User owns exactly 1 register → use it
 * 2. Default exists + user is unrestricted (admin) → use default
 * 3. Default exists + is in user's restricted list → use default
 * 4. Otherwise → empty string (no pre-selection)
 */
export function getDefaultCashRegister(referenceData: ReferenceDataT): string {
  const userCashRegisterIds = getUserCashRegisterIds(referenceData)
  const defaultCashRegisterId = getUserDefaultCashRegisterId(referenceData)

  if (userCashRegisterIds?.length === 1) return String(userCashRegisterIds[0])

  if (defaultCashRegisterId === undefined) return ''

  // Unrestricted user (admin) — userCashRegisterIds is undefined
  if (userCashRegisterIds === undefined) return String(defaultCashRegisterId)

  // Restricted user — only use default if it's in their allowed list
  if (userCashRegisterIds.includes(defaultCashRegisterId)) return String(defaultCashRegisterId)

  return ''
}
