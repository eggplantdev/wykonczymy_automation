import { z } from 'zod'
import {
  getNetAmountError,
  refineAmount,
  refineDate,
  refineDocumentIdentity,
} from '@/lib/utils/validation'
import { canFillVatPlane, needsOtherCategory, planeFor } from '@/lib/constants/transfers'
import { OTHER_CATEGORY_REQUIRED, validateTransferFields } from './transfer-validation'

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
    worker: z.string().optional().default(''),
    otherDescription: z.string().optional().default(''),
    invoiceNote: z.string().optional().default(''),
    vatPlane: z.string().optional().default(''),
    // `.catch` not `.optional()`: the deposit form's value type declares it required (a przelew
    // types it beside the netto), while every other form on this schema omits it entirely.
    amountGross: z.string().catch(''),
  })
  .superRefine((data, ctx) => {
    const paidGross = data.type === 'INVESTOR_DEPOSIT' && data.vatPlane === 'GROSS'
    refineAmount(
      paidGross ? { ...data, amount: data.amountGross } : data,
      ctx,
      paidGross ? 'amountGross' : 'amount',
    )
    if (paidGross) {
      const netErr = getNetAmountError(
        data.amount ? Number(data.amount) : undefined,
        data.amountGross ? Number(data.amountGross) : undefined,
        data.type,
        data.vatPlane,
      )
      if (netErr) ctx.addIssue({ code: 'custom', message: netErr, path: ['amount'] })
    }
    refineDate(data, ctx)
    validateTransferFields(data, ctx)
  })

export const editTransferFormSchema = (row: {
  type: string
  amount: number
  vatPlane: string | null
}) =>
  z
    .object({
      description: z.string(),
      amount: z.string().optional(),
      date: z.string().min(1, 'Data jest wymagana'),
      paymentMethod: z.string(),
      investment: z.string(),
      expenseCategory: z.string(),
      otherCategory: z.string(),
      invoiceNote: z.string(),
      worker: z.string(),
      documentNumber: z.string(),
      sellerNip: z.string(),
      documentDate: z.string(),
      netAmount: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.amount !== undefined)
        refineAmount({ ...data, amount: data.amount, type: row.type }, ctx)
      if (needsOtherCategory(row.type) && !data.otherCategory)
        ctx.addIssue({ code: 'custom', message: OTHER_CATEGORY_REQUIRED, path: ['otherCategory'] })
      refineDocumentIdentity(data, ctx)
      if (!canFillVatPlane(row)) return
      const netErr = getNetAmountError(
        data.netAmount ? Number(data.netAmount) : undefined,
        row.amount,
        row.type,
        planeFor(row.type, data.paymentMethod),
      )
      if (netErr) ctx.addIssue({ code: 'custom', message: netErr, path: ['netAmount'] })
    })
