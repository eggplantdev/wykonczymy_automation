/**
 * `?? 0` is the exact mistake it exists to prevent: for a stawka podwykonawcy, an unset column means
 * „derive it", and 0 zł is a price someone chose.
 */
export const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

export const text = (v: unknown): string => (v == null ? '' : String(v))

export const textOrNull = (v: unknown): string | null => (v == null ? null : String(v))

export const isoOrNull = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v)
