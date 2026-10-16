import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import type { DiscountTypeT } from '@/lib/kosztorys/types'

// discountType and discountValue are two independent fields, and applyDiscount reads the type
// first — so a value with no type is inert: it sits in the grid looking like a live discount while
// contributing nothing.

export type DiscountPairT = { discountType: DiscountTypeT | null; discountValue: number }

const IMPLIED_TYPE: DiscountTypeT = 'percent'

/**
 * Above it the row's net goes negative and
 * travels into the section and footer totals, reading as the client being owed money for work that
 * was done.
 */
export const MAX_DISCOUNT_PERCENT = 100

function withDiscountValue<RowT extends DiscountPairT>(current: RowT, value: number): RowT {
  return { ...current, discountType: current.discountType ?? IMPLIED_TYPE, discountValue: value }
}

export type DiscountTypeSwitchT =
  | { kind: 'change'; pair: DiscountPairT }
  | { kind: 'blocked'; message: string }

/**
 * The value slot is shared, so 150 zł re-read as a percentage is the one way past the ceiling with
 * no keystroke involved.
 */
export function discountFromType(
  current: DiscountPairT,
  next: DiscountTypeT | null,
): DiscountTypeSwitchT {
  if (next === null) return { kind: 'change', pair: { discountType: null, discountValue: 0 } }
  if (next === 'percent' && current.discountValue > MAX_DISCOUNT_PERCENT) {
    return {
      kind: 'blocked',
      message: `Rabat ${formatPLN(current.discountValue)} to więcej niż ${MAX_DISCOUNT_PERCENT}% — najpierw zmień wartość.`,
    }
  }
  return { kind: 'change', pair: { discountType: next, discountValue: current.discountValue } }
}

export function discountPolicy<RowT extends DiscountPairT>(): CellEditPolicyT<RowT, DiscountPairT> {
  return {
    snapshot: (row) => ({ discountType: row.discountType, discountValue: row.discountValue }),
    sameEntry: (a, b) => a.discountType === b.discountType && a.discountValue === b.discountValue,
    restore: (row, entry) => ({ ...row, ...entry }),
    applyValue: withDiscountValue,
    clear: (row) => ({ ...row, discountType: null, discountValue: 0 }),
    guard: (row) => {
      if (row.discountValue < 0) {
        return { severity: 'refuse', message: 'Rabat nie może być ujemny.' }
      }
      return row.discountType === 'percent' && row.discountValue > MAX_DISCOUNT_PERCENT
        ? {
            severity: 'refuse',
            message: `Rabat nie może przekroczyć ${MAX_DISCOUNT_PERCENT}%.`,
          }
        : null
    },
    restoredLabel: (row) =>
      row.discountType === null
        ? 'brak rabatu'
        : row.discountType === 'amount'
          ? formatPLN(row.discountValue)
          : `${formatQty(row.discountValue)}%`,
  }
}
