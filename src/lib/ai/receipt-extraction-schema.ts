import { z } from 'zod'

// Structured-output contract the vision model must fill; drives `generateObject` typing.
// `amount` is nullable so "no total legible on the receipt" is expressible (mapped to a
// blank form field). String fields carry `''` when the model finds nothing.
export const receiptExtractionSchema = z.object({
  description: z.string(),
  amount: z.number().nullable(),
  invoiceNote: z.string(),
  expenseCategoryName: z.string(),
})

export type ReceiptExtractionT = z.infer<typeof receiptExtractionSchema>
