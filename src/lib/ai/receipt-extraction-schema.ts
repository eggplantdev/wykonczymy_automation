import { z } from 'zod'

// Explicit sentinel the model returns as `description` when the image isn't a legible receipt,
// so the row shows a visible "couldn't read this" marker instead of a silent blank. The rename
// guard and the prompt both key off this one constant so they can't drift.
export const UNREADABLE_RECEIPT = 'NIE UDAŁO SIĘ ODCZYTAĆ !!! :('

// `amount` and `netAmount` are nullable so "no such total legible on the receipt" is expressible
// (mapped to a blank form field) — for `netAmount` that covers every paragon, which prints a brutto
// total only. String fields carry `''` when the model finds nothing.
export const receiptExtractionSchema = z.object({
  description: z.string(),
  amount: z.number().nullable(),
  netAmount: z.number().nullable(),
  invoiceNote: z.string(),
  otherCategoryName: z.string(),
  documentNumber: z.string(),
  sellerNip: z.string(),
  documentDate: z.string(),
})

export type ReceiptExtractionT = z.infer<typeof receiptExtractionSchema>
