import { z } from 'zod'
import { getNetAmountError, refineAmount, refineDate } from '@/lib/utils/validation'
import { canFillVatPlane, planeFor } from '@/lib/constants/transfers'
import { validateTransferFields } from './transfer-validation'

// The client-side twin of the server schemas in `./transfer.ts`: every transfer-creating and
// transfer-editing form validates against these, so the fields are typed as the strings HTML inputs
// hold and the server schema is what converts them. A form's own extras (line items, per-form
// fields) stay in that form's module.

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
    // A wpłata brutto is typed as two independent kwoty off one faktura, so each is checked as
    // itself — `amountGross` is the money that moved, `amount` the netto the faktura named beside
    // it. Everywhere else `amount` is the only kwota there is. Keyed on the type too, so the branch
    // cannot outlive the two-kwota UI, which only a wpłata od inwestora renders.
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

// A factory: the netto rule is keyed on the wpłata's brutto and type, which are facts about the row,
// not inputs. Taking the row is what lets this share the server's `getNetAmountError` without
// mirroring server data back into form state as fields no input renders.
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
      // The netto off the faktura, asked for only while filling in a legacy wpłata's missing plane.
      netAmount: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.amount !== undefined)
        refineAmount({ ...data, amount: data.amount, type: row.type }, ctx)
      // The method IS the plane, so „jak zapłacił" is what decides whether a netto is owed.
      if (!canFillVatPlane(row)) return
      const netErr = getNetAmountError(
        data.netAmount ? Number(data.netAmount) : undefined,
        row.amount,
        row.type,
        planeFor(row.type, data.paymentMethod),
      )
      if (netErr) ctx.addIssue({ code: 'custom', message: netErr, path: ['netAmount'] })
    })
