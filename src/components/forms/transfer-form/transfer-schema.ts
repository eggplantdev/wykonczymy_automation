import { z } from 'zod'
import {
  TRANSFER_TYPES,
  PAYMENT_METHODS,
  needsCashRegister,
  requiresInvestment,
  needsWorker,
  needsTargetRegister,
} from '@/lib/constants/transfers'
import { refineAmount, refineDate } from '@/lib/validation/shared-refinements'

// Shared type-dependent validation used by both server and client schemas.
// Works with both number and string values — checks truthiness only.
type TransferFieldsT = {
  type: string
  cashRegister?: unknown
  targetRegister?: unknown
  investment?: unknown
  worker?: unknown
  otherCategory?: unknown
}

type FieldRuleT = {
  readonly invalid: (d: TransferFieldsT) => boolean
  readonly message: string
  readonly path: string
}

const transferFieldRules: FieldRuleT[] = [
  {
    invalid: (d) => needsCashRegister(d.type) && !d.cashRegister,
    message: 'Kasa jest wymagana dla tego typu transferu',
    path: 'cashRegister',
  },
  {
    invalid: (d) => needsTargetRegister(d.type) && !d.targetRegister,
    message: 'Kasa docelowa jest wymagana dla transferu między kasami',
    path: 'targetRegister',
  },
  {
    invalid: (d) =>
      needsTargetRegister(d.type) && !!d.targetRegister && d.targetRegister === d.cashRegister,
    message: 'Kasa docelowa musi być inna niż kasa źródłowa',
    path: 'targetRegister',
  },
  {
    invalid: (d) => requiresInvestment(d.type) && !d.investment,
    message: 'Inwestycja jest wymagana dla tego typu transferu',
    path: 'investment',
  },
  {
    invalid: (d) => needsWorker(d.type) && !d.worker,
    message: 'Pracownik jest wymagany dla tego typu transferu',
    path: 'worker',
  },
  {
    invalid: (d) => d.type === 'OTHER' && !d.otherCategory,
    message: 'Kategoria jest wymagana dla transferu typu "Inne"',
    path: 'otherCategory',
  },
  {
    invalid: (d) => d.type === 'EMPLOYEE_EXPENSE' && !d.investment && !d.otherCategory,
    message: 'Inwestycja lub kategoria jest wymagana dla wydatku pracowniczego',
    path: 'investment',
  },
]

function validateTransferFields(data: TransferFieldsT, ctx: z.RefinementCtx) {
  for (const rule of transferFieldRules) {
    if (rule.invalid(data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.message, path: [rule.path] })
    }
  }
}

export const createTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0'),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    cashRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    invoiceNote: z.string().optional(),
  })
  .superRefine((data, ctx) => validateTransferFields(data, ctx))

export type CreateTransferFormT = z.infer<typeof createTransferSchema>

/**
 * Client-side form validation schema.
 * Works with string values (HTML inputs) — the server schema handles type conversion.
 */
export const transferFormSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    cashRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
    worker: z.string(),
    otherCategory: z.string(),
    otherDescription: z.string(),
    invoiceNote: z.string(),
  })
  .superRefine((data, ctx) => {
    refineAmount(data, ctx)
    refineDate(data, ctx)
    validateTransferFields(data, ctx)
  })
