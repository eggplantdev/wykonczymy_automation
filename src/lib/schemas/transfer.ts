import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { getAmountError, getNetAmountError, refineDocumentIdentity } from '@/lib/utils/validation'
import { validateTransferFields } from './transfer-validation'

export const createTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number(),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
    sourceRegister: z.number().optional(),
    targetRegister: z.number().optional(),
    investment: z.number().optional(),
    expenseCategory: z.number().optional(),
    otherCategory: z.number().optional(),
    worker: z.number().optional(),
    otherDescription: z.string().optional(),
    invoiceNote: z.string().optional(),
    vatPlane: z.enum(['NET', 'GROSS']).optional(),
    netAmount: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    const amountErr = getAmountError(data.amount, data.type)
    if (amountErr) {
      ctx.addIssue({ code: 'custom', message: amountErr, path: ['amount'] })
    }
    const netErr = getNetAmountError(data.netAmount, data.amount, data.type, data.vatPlane)
    if (netErr) {
      ctx.addIssue({ code: 'custom', message: netErr, path: ['netAmount'] })
    }
    validateTransferFields(data, ctx)
  })

export type CreateTransferFormT = z.infer<typeof createTransferSchema>

export const updateTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number().positive('Kwota musi być większa niż 0').optional(),
    date: z.string().min(1, 'Data jest wymagana'),
    paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
    investment: z.number().optional(),
    expenseCategory: z.number().optional(),
    otherCategory: z.number().optional(),
    invoiceNote: z.string().optional(),
    worker: z.number().positive().nullable().optional(),
    documentNumber: z.string().optional(),
    sellerNip: z.string().optional(),
    documentDate: z.string().optional(),
    vatPlane: z.enum(['NET', 'GROSS']).optional(),
    netAmount: z.number().optional(),
  })
  .superRefine((data, ctx) => refineDocumentIdentity(data, ctx))

export type UpdateTransferFormT = z.infer<typeof updateTransferSchema>

export const CANCEL_REASON_MIN_LENGTH = 3
export const CANCEL_REASON_MAX_LENGTH = 500

export const cancelTransferSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      CANCEL_REASON_MIN_LENGTH,
      `Powód anulowania musi mieć min. ${CANCEL_REASON_MIN_LENGTH} znaków`,
    )
    .max(
      CANCEL_REASON_MAX_LENGTH,
      `Powód anulowania może mieć maks. ${CANCEL_REASON_MAX_LENGTH} znaków`,
    ),
})

export type CancelTransferFormT = z.infer<typeof cancelTransferSchema>
