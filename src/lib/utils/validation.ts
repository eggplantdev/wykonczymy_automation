import { z } from 'zod'
import { carriesNetAmount } from '@/lib/constants/transfers'

/**
 * Returns an error message if the amount is invalid for the given type, or undefined if valid.
 * CORRECTION requires negative amounts (invoice corrections reduce costs).
 */
export function getAmountError(amount: number, type: string): string | undefined {
  if (type === 'CORRECTION') {
    return amount >= 0 ? 'Korekta musi mieć ujemną kwotę' : undefined
  }
  return amount <= 0 ? 'Kwota musi być większa niż 0' : undefined
}

/**
 * The netto figure stored beside brutto, checked wherever a row carries one — a netto wydatek
 * (which BILLS at it) and a wpłata brutto (which records what its faktura named). Above brutto it
 * would bill or credit more than moved; missing it would bill 0 (the billed-total helper never
 * falls back to brutto) or send a wpłata through the legacy VAT bridge. One home for all three
 * planes: the client form schema, the server create schema, and the Payload hook.
 */
export function getNetAmountError(
  netAmount: number | null | undefined,
  amount: number | null | undefined,
  type: string,
  vatPlane?: string | null,
): string | undefined {
  if (!carriesNetAmount(type, vatPlane)) return undefined
  if (netAmount == null || Number.isNaN(netAmount)) return 'Kwota netto jest wymagana'
  if (netAmount <= 0) return 'Kwota netto musi być większa niż 0'
  if (amount != null && !Number.isNaN(amount) && netAmount > amount) {
    return 'Kwota netto nie może przekraczać kwoty brutto'
  }
  return undefined
}

/** Validates that a string amount is present and valid for the given type (Zod refinement). */
// `path` names the field the message hangs under: a wpłata brutto validates the same `amount`, but
// the netto input is not on screen, so an issue parked there would block the submit invisibly.
export function refineAmount(
  data: { amount: string; type?: string },
  ctx: z.RefinementCtx,
  path: string = 'amount',
) {
  if (!data.amount) {
    ctx.addIssue({
      code: 'custom',
      message: 'Kwota musi być większa niż 0',
      path: [path],
    })
    return
  }
  const error = getAmountError(Number(data.amount), data.type ?? '')
  if (error) {
    ctx.addIssue({
      code: 'custom',
      message: error,
      path: [path],
    })
  }
}

/** Validates that a string date is present. */
export function refineDate(data: { date: string }, ctx: z.RefinementCtx) {
  if (!data.date) {
    ctx.addIssue({
      code: 'custom',
      message: 'Data jest wymagana',
      path: ['date'],
    })
  }
}

/** A money input that may be left blank — the faktura often arrives after the row does. */
export const optionalNonNegativeAmount = (message: string) =>
  z.string().refine((value) => value === '' || Number(value) >= 0, message)

/**
 * The `YYYY-MM-DD` a day picker produces. The shape is checked rather than assumed because the
 * server action parses the same schema, and a value that isn't a day lands in Postgres as an
 * Invalid Date instead of being refused.
 */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** A day input that may be left blank. */
export const optionalDay = () =>
  z.string().refine((value) => value === '' || DAY_PATTERN.test(value), 'Nieprawidłowa data')

/** A day input that is required, with its own „missing" message. */
export const requiredDay = (message: string) =>
  z.string().min(1, message).regex(DAY_PATTERN, 'Nieprawidłowa data')
