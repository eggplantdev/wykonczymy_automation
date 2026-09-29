import { z } from 'zod'

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const settleRowSchema = z.object({
  investmentId: z.number().int().positive(),
  // Nullable so the „Nieprzypisane" pair reaches the action and is refused with its reason, not with
  // a schema error that names no investment.
  workerId: z.number().int().positive().nullable(),
  amount: z.number().positive('Kwota musi być większa niż 0'),
  /** The pair's „Pozostało" the dialog showed — the action refuses when it no longer holds. */
  expectedRemaining: z.number(),
})

export const settlePayoutsSchema = z
  .object({
    date: z.string().regex(DAY_PATTERN, 'Data jest wymagana'),
    sourceRegister: z.number().int().positive('Kasa jest wymagana'),
    description: z.string().optional(),
    rows: z.array(settleRowSchema).min(1, 'Zaznacz co najmniej jedną wypłatę'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>()
    data.rows.forEach((row, index) => {
      const key = `${row.investmentId}:${row.workerId}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Ta sama para inwestycja × pracownik pojawia się dwa razy',
          path: ['rows', index],
        })
      }
      seen.add(key)
    })
  })

export type SettlePayoutsT = z.infer<typeof settlePayoutsSchema>
export type SettlePayoutRowT = SettlePayoutsT['rows'][number]
