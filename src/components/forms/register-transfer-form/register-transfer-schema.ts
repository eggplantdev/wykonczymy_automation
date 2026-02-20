import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/transfers'

export const createRegisterTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    cashRegister: z.number({ error: 'Kasa źródłowa jest wymagana' }),
    targetRegister: z.number({ error: 'Kasa docelowa jest wymagana' }),
  })
  .superRefine((data, ctx) => {
    if (data.targetRegister === data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa docelowa musi być inna niż kasa źródłowa',
        path: ['targetRegister'],
      })
    }
  })

export type CreateRegisterTransferFormT = z.infer<typeof createRegisterTransferSchema>

/**
 * Client-side form validation schema.
 * Works with string values (HTML inputs) — the server schema handles type conversion.
 */
export const registerTransferFormSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    date: z.string(),
    paymentMethod: z.string(),
    cashRegister: z.string(),
    targetRegister: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.amount || Number(data.amount) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kwota musi być większa niż 0',
        path: ['amount'],
      })
    }

    if (!data.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data jest wymagana',
        path: ['date'],
      })
    }

    if (!data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa źródłowa jest wymagana',
        path: ['cashRegister'],
      })
    }

    if (!data.targetRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa docelowa jest wymagana',
        path: ['targetRegister'],
      })
    }

    if (data.targetRegister && data.cashRegister && data.targetRegister === data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa docelowa musi być inna niż kasa źródłowa',
        path: ['targetRegister'],
      })
    }
  })
