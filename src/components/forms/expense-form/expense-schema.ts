import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { getAmountError, refineAmount, refineDate } from '@/lib/utils/validation'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import {
  validateTransferFields,
  validateLineItemCategories,
  createTransferSchema,
} from '@/lib/schemas/transfer'

export { createTransferSchema }

/**
 * Client-side form validation schema.
 * Works with string values (HTML inputs) — the server schema handles type conversion.
 */
export const expenseFormSchema = z
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
    worker: z.string().optional().default(''),
    otherDescription: z.string().optional().default(''),
    invoiceNote: z.string().optional().default(''),
    vatPlane: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    refineAmount(data, ctx)
    refineDate(data, ctx)
    validateTransferFields(data, ctx)
  })

// ---------------------------------------------------------------------------
// Bulk expense schemas (line-items pattern)
// ---------------------------------------------------------------------------

const lineItemClientSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.string(),
  invoiceNote: z.string(),
  category: z.string(),
  expenseCategory: z.string(),
})

export const bulkExpenseFormSchema = z
  .object({
    date: z.string(),
    type: z.string(),
    paymentMethod: z.string(),
    sourceRegister: z.string(),
    targetRegister: z.string(),
    investment: z.string(),
    worker: z.string(),
    settled: z.boolean(),
    lineItems: z.array(lineItemClientSchema),
  })
  .superRefine((data, ctx) => {
    refineDate(data, ctx)
    validateTransferFields(data, ctx)

    if (data.lineItems.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Dodaj co najmniej jedną pozycję',
        path: ['lineItems'],
      })
    }

    data.lineItems.forEach((item, index) => {
      if (item.description === UNREADABLE_RECEIPT) {
        ctx.addIssue({
          code: 'custom',
          message: 'Nie udało się odczytać tego paragonu — popraw pozycję ręcznie',
          path: ['lineItems', index, 'description'],
        })
      }
      if (!item.amount) {
        ctx.addIssue({
          code: 'custom',
          message: 'Kwota musi być większa niż 0',
          path: ['lineItems', index, 'amount'],
        })
        return
      }
      const err = getAmountError(Number(item.amount), data.type)
      if (err) {
        ctx.addIssue({
          code: 'custom',
          message: err,
          path: ['lineItems', index, 'amount'],
        })
      }
    })
    validateLineItemCategories(data.type, data.lineItems, ctx, !!data.investment)
  })

export const createBulkExpenseSchema = z
  .object({
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    worker: z.number().optional(),
    // Optional server-side so existing bulk-action callers needn't pass it; the
    // expense form always supplies it (defaults false). Non-INVESTMENT_EXPENSE
    // submissions are coerced to false in the action.
    settled: z.boolean().optional(),
    lineItems: z
      .array(
        z.object({
          description: z.string(),
          amount: z.number(),
          invoiceNote: z.string().optional(),
          category: z.number().positive().optional(),
          expenseCategory: z.number().positive().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => {
    validateTransferFields(data, ctx)

    data.lineItems.forEach((item, index) => {
      if (item.description === UNREADABLE_RECEIPT) {
        ctx.addIssue({
          code: 'custom',
          message: 'Nie udało się odczytać tego paragonu — popraw pozycję ręcznie',
          path: ['lineItems', index, 'description'],
        })
      }
      const err = getAmountError(item.amount, data.type)
      if (err) {
        ctx.addIssue({
          code: 'custom',
          message: err,
          path: ['lineItems', index, 'amount'],
        })
      }
    })

    validateLineItemCategories(data.type, data.lineItems, ctx, !!data.investment)
  })

export type CreateBulkExpenseFormT = z.infer<typeof createBulkExpenseSchema>

// ---------------------------------------------------------------------------
// Edit expense schema (client-side, string values)
// ---------------------------------------------------------------------------

export const editExpenseFormSchema = z
  .object({
    description: z.string(),
    amount: z.string().optional(),
    date: z.string().min(1, 'Data jest wymagana'),
    paymentMethod: z.string(),
    investment: z.string(),
    expenseCategory: z.string(),
    otherCategory: z.string(),
    invoiceNote: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.amount !== undefined) refineAmount(data as { amount: string; type?: string }, ctx)
  })
