/**
 * Discriminated result every server action returns. With TData, success carries a payload.
 * `warning` is an optional non-error notice on an otherwise-successful action — a partial-success
 * the caller surfaces alongside the success toast (e.g. investment created but its kosztorys seed
 * failed). It never flips success; a hard failure is the `{ success: false }` branch.
 */
export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true; warning?: string } | { success: false; error: string }
  : { success: true; data: TData; warning?: string } | { success: false; error: string }
