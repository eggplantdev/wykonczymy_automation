import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Clear the "already announced" stamps that an edit invalidates.
 *
 * `reset` is handed the stored document and the UPDATE PATCH — not the next document — so an absent
 * key reads as "untouched" and the sweep's own stamp write cannot erase the stamp it is writing.
 * On a create there is nothing announced yet, so the hook is a pass-through.
 */
export const makeResetBookkeeping =
  <TStoredT, TPatchT, TResetT extends object>(
    reset: (stored: TStoredT, patch: TPatchT) => TResetT,
  ): CollectionBeforeChangeHook =>
  ({ data, originalDoc, operation }) =>
    operation === 'update' && originalDoc
      ? { ...data, ...reset(originalDoc as TStoredT, data as TPatchT) }
      : data
