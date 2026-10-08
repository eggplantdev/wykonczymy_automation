import { COMPANY_NIPS } from '@/lib/constants/company'
import { dayBound } from '@/lib/utils/date-range'
import { normalizeNip } from '@/lib/utils/nip'
import type { ReceiptExtractionT } from './receipt-extraction-schema'

/**
 * The model's identity fields as the duplicate check can trust them, `''` meaning „not read".
 * Our own NIP is the buyer's printed on a faktura, never the seller's — kept, it would make every
 * faktura from every shop share one seller.
 */
export function sanitizeReceiptExtraction(read: ReceiptExtractionT): ReceiptExtractionT {
  const sellerNip = normalizeNip(read.sellerNip)
  return {
    ...read,
    documentNumber: read.documentNumber.trim(),
    sellerNip: sellerNip && !COMPANY_NIPS.includes(sellerNip) ? sellerNip : '',
    documentDate: dayBound(read.documentDate.trim()) ?? '',
  }
}
