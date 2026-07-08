/** Discriminated result every server action returns. With TData, success carries a payload. */
export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }
