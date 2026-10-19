import type { CollectionBeforeChangeHook } from 'payload'

export const makeResetBookkeeping =
  <TStoredT, TPatchT, TResetT extends object>(
    reset: (stored: TStoredT, patch: TPatchT) => TResetT,
  ): CollectionBeforeChangeHook =>
  ({ data, originalDoc, operation }) =>
    operation === 'update' && originalDoc
      ? { ...data, ...reset(originalDoc as TStoredT, data as TPatchT) }
      : data
