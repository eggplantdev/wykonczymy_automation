/**
 * Machine-readable failure kind, set alongside the human `error` where the CALLER can react to the
 * kind rather than to the sentence. `NOT_FOUND` means the row the write targeted is gone — for an
 * editor holding a mount-frozen copy of the tree that is not "your edit was rejected", it is "your
 * whole copy is stale", which is a different recovery (reseed) than a revert. `REQUEST_FAILED` is
 * set only client-side by `settleAction`: the request never completed, so whether the write
 * committed is unknown.
 */
export type ActionErrorCodeT = 'NOT_FOUND' | 'REQUEST_FAILED'

type FailureT = { success: false; error: string; code?: ActionErrorCodeT }

/**
 * Discriminated result every server action returns. With TData, success carries a payload.
 * `warning` is an optional non-error notice on an otherwise-successful action — a partial-success
 * the caller surfaces alongside the success toast (e.g. investment created but its kosztorys seed
 * failed). It never flips success; a hard failure is the `{ success: false }` branch.
 */
export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true; warning?: string } | FailureT
  : { success: true; data: TData; warning?: string } | FailureT
