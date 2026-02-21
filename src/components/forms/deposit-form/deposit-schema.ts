import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/transfers'
import { refineAmount, refineDate } from '@/lib/validation/shared-refinements'

// Deposit types allowed in the UI
const DEPOSIT_TYPES_ENUM = ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT', 'COMPANY_FUNDING'] as const

export const createDepositSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(DEPOSIT_TYPES_ENUM),
    paymentMethod: z.enum(PAYMENT_METHODS),
    cashRegister: z.number({ error: 'Kasa jest wymagana' }),
    investment: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.type === 'INVESTOR_DEPOSIT' || data.type === 'STAGE_SETTLEMENT') &&
      !data.investment
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana dla tego typu wpłaty',
        path: ['investment'],
      })
    }
  })

export type CreateDepositFormT = z.infer<typeof createDepositSchema>

/**
 * Client-side form validation schema.
 * Works with string values (HTML inputs) — the server schema handles type conversion.
 */
export const depositFormSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    cashRegister: z.string(),
    investment: z.string(),
  })
  .superRefine((data, ctx) => {
    refineAmount(data, ctx)
    refineDate(data, ctx)

    if (!data.cashRegister) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kasa jest wymagana',
        path: ['cashRegister'],
      })
    }

    if (
      (data.type === 'INVESTOR_DEPOSIT' || data.type === 'STAGE_SETTLEMENT') &&
      !data.investment
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inwestycja jest wymagana dla tego typu wpłaty',
        path: ['investment'],
      })
    }
  })
