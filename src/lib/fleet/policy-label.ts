import type { InspectionHistoryEntryT } from '@/lib/fleet/types'

/**
 * „Ubezpieczyciel · nr polisy" for the polisa currently in force — the first entry, since the history
 * arrives newest-first out of `historyOfType`.
 */
export const currentPolicyLabel = (
  insuranceHistory: readonly InspectionHistoryEntryT[],
): string => {
  const current = insuranceHistory[0]
  if (!current) return ''

  return [current.insurer, current.policyNumber].filter(Boolean).join(' · ')
}
