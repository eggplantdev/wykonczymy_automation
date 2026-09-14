/**
 * A nullable numeric column, coerced without losing the null. Shared rather than re-typed per mapper
 * because `?? 0` is the exact mistake it exists to prevent: for a stawka podwykonawcy, an unset
 * column means „derive it", and 0 zł is a price someone chose (EX-766).
 */
export const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

/** A text column as a string, never `null` — an absent name renders as „—", not as the word "null". */
export const text = (v: unknown): string => (v == null ? '' : String(v))

/** A real instant. Day-only columns go through `toWarsawDay` instead — see `lib/utils/days.ts`. */
export const isoOrNull = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v)
