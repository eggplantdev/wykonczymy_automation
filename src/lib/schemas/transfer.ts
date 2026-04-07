import { z } from 'zod'
import {
  TRANSFER_TYPES,
  PAYMENT_METHODS,
  needsSourceRegister,
  requiresInvestment,
  needsTargetRegister,
  needsExpenseCategory,
} from '@/lib/constants/transfers'
import { getAmountError } from '@/lib/validation-utils'

// ---------------------------------------------------------------------------
// Shared type-dependent validation
// ---------------------------------------------------------------------------

type TransferFieldsT = {
  type: string
  sourceRegister?: unknown
  targetRegister?: unknown
  investment?: unknown
  expenseCategory?: unknown
  otherCategory?: unknown
}

type FieldRuleT = {
  invalid: (d: TransferFieldsT) => boolean
  message: string
  path: string
}

const transferFieldRules: FieldRuleT[] = [
  {
    invalid: (d) => needsSourceRegister(d.type) && !d.sourceRegister,
    message: 'Kasa jest wymagana dla tego typu transferu',
    path: 'sourceRegister',
  },
  {
    invalid: (d) => needsTargetRegister(d.type) && !d.targetRegister,
    message: 'Kasa docelowa jest wymagana dla transferu między kasami',
    path: 'targetRegister',
  },
  {
    invalid: (d) =>
      needsTargetRegister(d.type) && !!d.targetRegister && d.targetRegister === d.sourceRegister,
    message: 'Kasa docelowa musi być inna niż kasa źródłowa',
    path: 'targetRegister',
  },
  {
    invalid: (d) => requiresInvestment(d.type) && !d.investment,
    message: 'Inwestycja jest wymagana dla tego typu transferu',
    path: 'investment',
  },
  {
    invalid: (d) => needsExpenseCategory(d.type) && !('lineItems' in d) && !d.expenseCategory,
    message: 'Typ wydatku inwestycyjnego jest wymagany',
    path: 'expenseCategory',
  },
]

export function validateTransferFields(data: TransferFieldsT, ctx: z.RefinementCtx) {
  for (const rule of transferFieldRules) {
    if (rule.invalid(data)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.message, path: [rule.path] })
    }
  }
}

export function validateLineItemCategories(
  type: string,
  lineItems: { category?: unknown; expenseCategory?: unknown }[],
  ctx: z.RefinementCtx,
) {
  lineItems.forEach((item, index) => {
    if (type === 'INVESTMENT_EXPENSE' && !item.expenseCategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Typ wydatku inwestycyjnego jest wymagany',
        path: ['lineItems', index, 'expenseCategory'],
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Server-side schema for single transfers
// ---------------------------------------------------------------------------

export const createTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number(),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    expenseCategory: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    invoiceNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const amountErr = getAmountError(data.amount, data.type)
    if (amountErr) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: amountErr, path: ['amount'] })
    }
    validateTransferFields(data, ctx)
  })

export type CreateTransferFormT = z.infer<typeof createTransferSchema>

// ---------------------------------------------------------------------------
// Server-side schema for updating transfers (metadata fields only)
// ---------------------------------------------------------------------------

export const updateTransferSchema = z.object({
  description: z.string().optional().default(''),
  amount: z.number().positive('Kwota musi być większa niż 0').optional(),
  date: z.string().min(1, 'Data jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  investment: z.number().optional(),
  expenseCategory: z.number().optional(),
  otherCategory: z.number().optional(),
  invoiceNote: z.string().optional(),
})

export type UpdateTransferFormT = z.infer<typeof updateTransferSchema>
