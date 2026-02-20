import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/transfers'

// ---------------------------------------------------------------------------
// Settlement form
// ---------------------------------------------------------------------------

const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
  category: z.string().optional(),
  note: z.string().optional(),
})

/** Client-side schema — works with string values from HTML inputs. */
export const settlementFormSchema = z
  .object({
    worker: z.string(),
    mode: z.enum(['investment', 'category']),
    investment: z.string().optional(),
    date: z.string(),
    paymentMethod: z.string(),
    invoiceNote: z.string(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.worker) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pracownik jest wymagany',
        path: ['worker'],
      })
    }

    if (data.mode === 'investment' && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Opis jest wymagany',
          path: ['lineItems', index, 'description'],
        })
      }
      if (!item.amount || Number(item.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
      }
      if (data.mode === 'category') {
        if (!item.category) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Kategoria jest wymagana',
            path: ['lineItems', index, 'category'],
          })
        }
      }
    })
  })

/** Server-side schema — typed values after conversion. */
export const createSettlementSchema = z
  .object({
    worker: z.number({ error: 'Pracownik jest wymagany' }).positive('Pracownik jest wymagany'),
    mode: z.enum(['investment', 'category']),
    investment: z.number().positive().optional(),
    date: z.string().min(1, 'Data jest wymagana'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    invoiceNote: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string().min(1, 'Opis jest wymagany'),
          amount: z.number().positive('Kwota musi być większa niż 0'),
          category: z.number().positive().optional(),
          note: z.string().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'investment' && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (data.mode === 'category') {
      data.lineItems.forEach((item, index) => {
        if (!item.category) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Kategoria jest wymagana',
            path: ['lineItems', index, 'category'],
          })
        }
      })
    }
  })

export type CreateSettlementFormT = z.infer<typeof createSettlementSchema>
