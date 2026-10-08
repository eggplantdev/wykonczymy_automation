import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import {
  getAmountError,
  getNetAmountError,
  refineDate,
  refineDocumentIdentity,
} from '@/lib/utils/validation'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import {
  validateTransferFields,
  validateLineItemCategories,
} from '@/lib/schemas/transfer-validation'

function refineNetAmount(
  item: { amount: number; netAmount?: number },
  type: string,
  ctx: z.RefinementCtx,
  index: number,
) {
  const error = getNetAmountError(item.netAmount, item.amount, type)
  if (error) {
    ctx.addIssue({ code: 'custom', message: error, path: ['lineItems', index, 'netAmount'] })
  }
}

const lineItemClientSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.string(),
  // `.catch` not `.optional()`: a recovery snapshot persisted before the netto type existed has no
  // netAmount and must still parse, but the form's value type declares it required — an optional
  // input type would no longer satisfy TanStack's validator slot. The per-row refine below is what
  // makes it required on the type that bills at it.
  netAmount: z.string().catch(''),
  invoiceNote: z.string(),
  // `.catch` for the same recovery-snapshot reason as `netAmount`.
  documentNumber: z.string().catch(''),
  sellerNip: z.string().catch(''),
  documentDate: z.string().catch(''),
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
      refineDocumentIdentity(item, ctx, ['lineItems', index])
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
      refineNetAmount(
        {
          amount: Number(item.amount),
          netAmount: item.netAmount ? Number(item.netAmount) : undefined,
        },
        data.type,
        ctx,
        index,
      )
    })
    validateLineItemCategories(data.type, data.lineItems, ctx, !!data.investment)
  })

export const createBulkExpenseSchema = z
  .object({
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
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
          netAmount: z.number().optional(),
          invoiceNote: z.string().optional(),
          documentNumber: z.string().optional(),
          sellerNip: z.string().optional(),
          documentDate: z.string().optional(),
          category: z.number().positive().optional(),
          expenseCategory: z.number().positive().optional(),
        }),
      )
      .min(1, 'Dodaj co najmniej jedną pozycję'),
  })
  .superRefine((data, ctx) => {
    validateTransferFields(data, ctx)

    data.lineItems.forEach((item, index) => {
      refineDocumentIdentity(item, ctx, ['lineItems', index])
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
      refineNetAmount(item, data.type, ctx, index)
    })

    validateLineItemCategories(data.type, data.lineItems, ctx, !!data.investment)
  })

export type CreateBulkExpenseFormT = z.infer<typeof createBulkExpenseSchema>
