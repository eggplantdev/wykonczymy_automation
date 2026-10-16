type BookkeepingT = {
  notifiedThreshold?: null
  notifiedAt?: null
  odometerNotifiedAt?: null
}

type StoredFieldsT = {
  nextDueAt?: string | null
  odometer?: number | null
}

type PatchT = Partial<StoredFieldsT>

/**
 * `patch` is an UPDATE PATCH, not the next document: an absent key means untouched — a present `null` is the clear.
 */
export const resetNotificationBookkeeping = (
  stored: StoredFieldsT,
  patch: PatchT,
): BookkeepingT => {
  const changed = (field: keyof StoredFieldsT) =>
    field in patch && (stored[field] ?? null) !== (patch[field] ?? null)

  return {
    ...(changed('nextDueAt') && { notifiedThreshold: null, notifiedAt: null }),
    ...(changed('odometer') && { odometerNotifiedAt: null }),
  }
}
