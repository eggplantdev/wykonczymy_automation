import { z } from 'zod'
import {
  TRANSFER_TYPES,
  PAYMENT_METHODS,
  needsSourceRegister,
  requiresInvestment,
  needsWorker,
  needsTargetRegister,
  needsExpenseCategory,
} from '@/lib/constants/transfers'
import { refineAmount, refineDate } from '@/lib/validation-utils'

// Shared type-dependent validation used by both server and client schemas.
// Works with both number and string values — checks truthiness only.
type TransferFieldsT = {
  type: string
  sourceRegister?: unknown
  targetRegister?: unknown
  investment?: unknown
  worker?: unknown
  expenseCategory?: unknown
  otherCategory?: unknown
}

type FieldRuleT = {
  readonly invalid: (d: TransferFieldsT) => boolean
  readonly message: string
  readonly path: string
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
    invalid: (d) => needsWorker(d.type) && !d.worker,
    message: 'Pracownik jest wymagany dla tego typu transferu',
    path: 'worker',
  },
  {
    invalid: (d) => d.type === 'OTHER' && !d.otherCategory,
    message: 'Kategoria jest wymagana dla transferu typu "Inny wydatek"',
    path: 'otherCategory',
  },
  {
    invalid: (d) => d.type === 'EMPLOYEE_EXPENSE' && !d.investment && !d.otherCategory,
    message: 'Inwestycja lub kategoria jest wymagana dla wydatku pracowniczego',
    path: 'investment',
  },
  {
    invalid: (d) => needsExpenseCategory(d.type) && !d.expenseCategory,
    message: 'Kategoria wydatku jest wymagana',
    path: 'expenseCategory',
  },
  {
    invalid: (d) => d.type === 'EMPLOYEE_EXPENSE' && !!d.investment && !d.expenseCategory,
    message: 'Kategoria wydatku jest wymagana',
    path: 'expenseCategory',
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
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    expenseCategory: z.number().optional(),
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
    sourceRegister: z.string(),
    targetRegister: z.string().optional().default(''),
    investment: z.string().optional().default(''),
    worker: z.string().optional().default(''),
    expenseCategory: z.string().optional().default(''),
    otherCategory: z.string().optional().default(''),
    otherDescription: z.string().optional().default(''),
    invoiceNote: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    refineAmount(data, ctx)
    refineDate(data, ctx)
    validateTransferFields(data, ctx)
  })

// ---------------------------------------------------------------------------
// Bulk transfer schemas (line-items pattern)
// ---------------------------------------------------------------------------

const lineItemClientSchema = z.object({
  description: z.string(),
  amount: z.string(),
  invoiceNote: z.string(),
})

export const bulkTransferFormSchema = z
  .object({
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    sourceRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
    worker: z.string(),
    expenseCategory: z.string(),
    otherCategory: z.string(),
    otherDescription: z.string(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    refineDate(data, ctx)
    validateTransferFields(data, ctx)

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (!item.amount || Number(item.amount) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
      }
    })
  })

export const createBulkTransferSchema = z
  .object({
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    expenseCategory: z.number().optional(),
    otherCategory: z.number().optional(),
    otherDescription: z.string().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number().positive('Kwota musi być większa niż 0'),
          invoiceNote: z.string().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => validateTransferFields(data, ctx))

export type CreateBulkTransferFormT = z.infer<typeof createBulkTransferSchema>
