export const EQUIPMENT_STATUSES = ['IN_USE', 'RETIRED', 'SOLD', 'LOST', 'STOLEN'] as const

export type EquipmentStatusT = (typeof EQUIPMENT_STATUSES)[number]

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatusT, { en: string; pl: string }> = {
  IN_USE: { en: 'In use', pl: 'W użyciu' },
  RETIRED: { en: 'Retired', pl: 'Wycofany' },
  SOLD: { en: 'Sold', pl: 'Sprzedany' },
  LOST: { en: 'Lost', pl: 'Zgubiony' },
  STOLEN: { en: 'Stolen', pl: 'Skradziony' },
}

/**
 * Statuses whose missing holder is an ANSWER, not a gap.
 *
 * A sold or stolen item legitimately has nobody holding it, so „nie wiadomo gdzie" would be a false
 * alarm; only an `IN_USE` item with no current event is a hole in the data. The warranty digest
 * reads the same predicate — chasing the warranty of a sold drill is history, not a task.
 */
export const LIVE_EQUIPMENT_STATUSES = ['IN_USE'] as const

export const isLiveStatus = (status: EquipmentStatusT): boolean =>
  (LIVE_EQUIPMENT_STATUSES as readonly string[]).includes(status)
