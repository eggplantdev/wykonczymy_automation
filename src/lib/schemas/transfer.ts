import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { getAmountError } from '@/lib/utils/validation'
import { validateTransferFields } from './transfer-validation'

// Shared refinement helpers moved to transfer-validation.ts (also used by the bulk
// expense schema). Re-exported so existing importers of this module keep working.
export { validateTransferFields, validateLineItemCategories } from './transfer-validation'

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
    worker: z.number().optional(),
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

// ---------------------------------------------------------------------------
// Server-side schema for cancelling a transfer — reason is required
// ---------------------------------------------------------------------------

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
