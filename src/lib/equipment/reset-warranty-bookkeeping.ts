type BookkeepingT = {
  warrantyNotifiedBucket?: null
  warrantyNotifiedAt?: null
}

type StoredFieldsT = {
  warrantyUntil?: string | null
}

/** A Payload `beforeChange` patch: only the fields the write actually names. */
type PatchT = Partial<StoredFieldsT>

/**
 * Which "already announced" stamp an edit invalidates.
 *
 * The stamp exists so one warranty earns one email per threshold, but it is keyed to the date that
 * was announced. Extend a warranty by a year and, without this, the row stays marked announced for
 * a date nobody was ever told about — the new deadline never mails at all.
 *
 * Unlike the fleet's twin (`lib/fleet/reset-notification-bookkeeping.ts`) this hangs on the ENTITY,
 * not on an event row, because a warranty is a property of the thing rather than of something that
 * happened to it. `patch` is an UPDATE PATCH, not the next document: an absent key means untouched,
 * a present `null` is a clear. Read it as a document instead and the sweep's own stamp write erases
 * the stamp it is writing.
 */
export const resetWarrantyBookkeeping = (stored: StoredFieldsT, patch: PatchT): BookkeepingT => {
  const changed =
    'warrantyUntil' in patch && (stored.warrantyUntil ?? null) !== (patch.warrantyUntil ?? null)

  return changed ? { warrantyNotifiedBucket: null, warrantyNotifiedAt: null } : {}
}
