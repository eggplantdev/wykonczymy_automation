import { z } from 'zod'

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

/** Validates that a string amount is present and valid for the given type (Zod refinement). */
export function refineAmount(data: { amount: string; type?: string }, ctx: z.RefinementCtx) {
  if (!data.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Kwota musi być większa niż 0',
      path: ['amount'],
    })
    return
  }
  const error = getAmountError(Number(data.amount), data.type ?? '')
  if (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error,
      path: ['amount'],
    })
  }
}

/** Validates that a string date is present. */
export function refineDate(data: { date: string }, ctx: z.RefinementCtx) {
  if (!data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data jest wymagana',
      path: ['date'],
    })
  }
}
