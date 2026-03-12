import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { refineAmount, refineDate } from '@/lib/validation-utils'
import {
  validateTransferFields,
  validateLineItemCategories,
  createTransferSchema,
  type CreateTransferFormT,
} from '@/lib/schemas/transfer'

export { createTransferSchema, type CreateTransferFormT }

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
  category: z.string(),
  expenseCategory: z.string(),
})

export const bulkTransferFormSchema = z
  .object({
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    sourceRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
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
    validateLineItemCategories(data.type, data.lineItems, ctx)
  })

export const createBulkTransferSchema = z
  .object({
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number().positive('Kwota musi być większa niż 0'),
          invoiceNote: z.string().optional(),
          category: z.number().positive().optional(),
          expenseCategory: z.number().positive().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => {
    validateTransferFields(data, ctx)

    validateLineItemCategories(data.type, data.lineItems, ctx)
  })

export type CreateBulkTransferFormT = z.infer<typeof createBulkTransferSchema>

// ---------------------------------------------------------------------------
// Edit transfer schema (client-side, string values)
// ---------------------------------------------------------------------------

export const editTransferFormSchema = z
  .object({
    description: z.string(),
    date: z.string(),
    paymentMethod: z.string(),
    investment: z.string(),
    expenseCategory: z.string(),
    otherCategory: z.string(),
    invoiceNote: z.string(),
  })
  .superRefine((data, ctx) => {
    refineDate(data, ctx)
  })
