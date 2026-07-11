import { z } from 'zod'

// Explicit sentinel the model returns as `description` when the image isn't a legible receipt,
// so the row shows a visible "couldn't read this" marker instead of a silent blank. The rename
// guard and the prompt both key off this one constant so they can't drift.
export const UNREADABLE_RECEIPT = 'NIE UDAŁO SIĘ ODCZYTAĆ !!! :('

// `amount` is nullable so "no total legible on the receipt" is expressible (mapped to a
// blank form field). String fields carry `''` when the model finds nothing.
export const receiptExtractionSchema = z.object({
  description: z.string(),
  amount: z.number().nullable(),
  invoiceNote: z.string(),
  expenseCategoryName: z.string(),
  otherCategoryName: z.string(),
})

export type ReceiptExtractionT = z.infer<typeof receiptExtractionSchema>
