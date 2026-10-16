import { TRANSACTION_TRANSFER_TYPES } from '@/lib/constants/transfers'

const DRAFT_FALLBACK_TYPE = 'INVESTMENT_EXPENSE'

/**
 * A draft outlives the deploy that removed its type from the dialog, and the Select silently renders
 * empty for a value it has no option for — while the form goes on submitting that value.
 */
export function restorableType(type: string): string {
  return (TRANSACTION_TRANSFER_TYPES as string[]).includes(type) ? type : DRAFT_FALLBACK_TYPE
}
