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

export const SETTLEMENT_MODES = ['investment', 'category', 'register'] as const
export type SettlementModeT = (typeof SETTLEMENT_MODES)[number]

/** Client-side schema — works with string values from HTML inputs. */
export const settlementFormSchema = z
  .object({
    worker: z.string(),
    mode: z.enum(SETTLEMENT_MODES),
    investment: z.string(),
    cashRegister: z.string(),
    amount: z.string(),
    description: z.string(),
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

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (data.mode === 'investment' && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (data.mode === 'register') {
      if (!data.cashRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa jest wymagana',
          path: ['cashRegister'],
        })
      }
      if (!data.amount || Number(data.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['amount'],
        })
      }
      return
    }

    // Line item validation (investment + category modes only)
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
    mode: z.enum(SETTLEMENT_MODES),
    investment: z.number().positive().optional(),
    cashRegister: z.number().positive().optional(),
    amount: z.number().positive('Kwota musi być większa niż 0').optional(),
    description: z.string().optional(),
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
      .default([]),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'investment' && !data.investment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana',
        path: ['investment'],
      })
    }

    if (data.mode === 'register') {
      if (!data.cashRegister) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kasa jest wymagana',
          path: ['cashRegister'],
        })
      }
      if (!data.amount || data.amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['amount'],
        })
      }
      return
    }

    // Line item validation (investment + category modes only)
    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
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
