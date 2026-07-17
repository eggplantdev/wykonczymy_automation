import type { DiscountTypeT } from '@/types/kosztorys'

// discountType and discountValue are two independent fields, and applyDiscount reads the type
// first — so a value with no type is inert: it sits in the grid looking like a live discount while
// contributing nothing. These transitions keep the pair consistent from both directions, and live
// here (not in the cell) because the trap is the state transition, not the input element.

export type DiscountPairT = { discountType: DiscountTypeT | null; discountValue: number }

// Percent, not amount: a rabat is asked for in % far more often than in zł.
const IMPLIED_TYPE: DiscountTypeT = 'percent'

/** Editing the value: a number with no type set implies one; clearing the field drops the discount. */
export function discountFromValue(current: DiscountPairT, raw: string): DiscountPairT | null {
  const trimmed = raw.trim().replace(',', '.')
  if (trimmed === '') return { discountType: null, discountValue: 0 }
  const discountValue = Number(trimmed)
  // Reject rather than clear: mid-typing garbage ("1e", "-") must not wipe the row's discount.
  if (Number.isNaN(discountValue)) return null
  return { discountType: current.discountType ?? IMPLIED_TYPE, discountValue }
}

/** Editing the type: clearing it clears the value, so no orphan can be left behind. */
export function discountFromType(
  current: DiscountPairT,
  next: DiscountTypeT | null,
): DiscountPairT {
  return { discountType: next, discountValue: next === null ? 0 : current.discountValue }
}
