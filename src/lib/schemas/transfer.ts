import { z } from 'zod'
import { TRANSFER_TYPES, PAYMENT_METHODS } from '@/lib/constants/transfers'
import { getAmountError, getNetAmountError } from '@/lib/utils/validation'
import { validateTransferFields } from './transfer-validation'

// ---------------------------------------------------------------------------
// Server-side schema for single transfers
// ---------------------------------------------------------------------------

export const createTransferSchema = z
  .object({
    description: z.string().optional().default(''),
    amount: z.number(),
    date: z.string().min(1, 'Data jest wymagana'),
    type: z.enum(TRANSFER_TYPES),
    // Null on every type that never asks — `carriesPaymentMethod` is what makes it required on the
    // two that do, from `validateTransferFields` below.
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
    // The netto off the faktura on a wpłata brutto. Optional here because most types carry no
    // netto at all — which rows must have one is `carriesNetAmount`, enforced below and again in
    // the Payload hook.
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

// ---------------------------------------------------------------------------
// Server-side schema for updating transfers (metadata fields only)
// ---------------------------------------------------------------------------

export const updateTransferSchema = z.object({
  description: z.string().optional().default(''),
  amount: z.number().positive('Kwota musi być większa niż 0').optional(),
  date: z.string().min(1, 'Data jest wymagana'),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  investment: z.number().optional(),
  expenseCategory: z.number().optional(),
  otherCategory: z.number().optional(),
  invoiceNote: z.string().optional(),
  // `null` clears. `updateTransferAction` drops it on every type but OTHER.
  worker: z.number().positive().nullable().optional(),
  // Only ever a FILL-IN on a legacy wpłata that carries neither. Both rules that govern it need the
  // stored row, which no schema has: `updateTransferAction` decides whether the answer is sent, and
  // `hooks/transfers/validate.ts` refuses to move one already booked.
  vatPlane: z.enum(['NET', 'GROSS']).optional(),
  netAmount: z.number().optional(),
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
