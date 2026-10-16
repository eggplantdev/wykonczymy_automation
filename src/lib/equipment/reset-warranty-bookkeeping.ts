type BookkeepingT = {
  warrantyNotifiedBucket?: null
  warrantyNotifiedAt?: null
}

type StoredFieldsT = {
  warrantyUntil?: string | null
}

type PatchT = Partial<StoredFieldsT>

/**
 * `patch` is an UPDATE PATCH, not the next document: an absent key means untouched,
 * a present `null` is a clear.
 */
export const resetWarrantyBookkeeping = (stored: StoredFieldsT, patch: PatchT): BookkeepingT => {
  const changed =
    'warrantyUntil' in patch && (stored.warrantyUntil ?? null) !== (patch.warrantyUntil ?? null)

  return changed ? { warrantyNotifiedBucket: null, warrantyNotifiedAt: null } : {}
}
