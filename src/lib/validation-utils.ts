import { z } from 'zod'

/** Validates that a string amount is present and > 0. */
export function refineAmount(data: { amount: string }, ctx: z.RefinementCtx) {
  if (!data.amount || Number(data.amount) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Kwota musi być większa niż 0',
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
