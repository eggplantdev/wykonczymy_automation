import { z } from 'zod'

export const UNREADABLE_RECEIPT = 'NIE UDAŁO SIĘ ODCZYTAĆ !!! :('

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

export const receiptListExtractionSchema = z.object({ receipts: z.array(receiptExtractionSchema) })
