import { type CellEditPolicyT } from '@/lib/kosztorys/cell-edit'
import { formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import type { DiscountTypeT } from '@/lib/kosztorys/types'

// discountType and discountValue are two independent fields, and applyDiscount reads the type
// first — so a value with no type is inert: it sits in the grid looking like a live discount while
// contributing nothing. These transitions keep the pair consistent from both directions, and live
// here (not in the cell) because the trap is the state transition, not the input element.

export type DiscountPairT = { discountType: DiscountTypeT | null; discountValue: number }

// Percent, not amount: a rabat is asked for in % far more often than in zł.
const IMPLIED_TYPE: DiscountTypeT = 'percent'

/**
 * 100% is work given away, a real commercial decision. Above it the row's net goes negative and
 * travels into the section and footer totals, reading as the client being owed money for work that
 * was done (owner, 2026-08-25).
 *
 * Ceiling on the PERCENT plane only — „250" in a rabat kwotowy is an ordinary 250 zł. Floor on both:
 * „-50" raises the price of the offer through the one field the client reads as a discount.
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
 * no keystroke involved. Refused rather than capped — silently making it 100% gives the row away for
 * free (owner, 2026-08-25).
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

/**
 * „Rabat wart." as a cell policy. The pair is the point: every write moves both fields together,
 * which is the orphan-value bug this module exists for. The guard reads that same pair, because
 * whether a typed „150" is out of range depends entirely on the type standing next to it.
 */
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
    // Named in the unit the row was actually carrying — „przywrócono 10" reads as złotówki to
    // anyone who wasn't looking at „Rabat" when the toast fired.
    restoredLabel: (row) =>
      row.discountType === null
        ? 'brak rabatu'
        : row.discountType === 'amount'
          ? formatPLN(row.discountValue)
          : `${formatQty(row.discountValue)}%`,
  }
}
