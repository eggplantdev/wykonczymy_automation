import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'

export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

export const isExpenseDraftStatus = (value: string): value is ExpenseDraftStatusT =>
  (EXPENSE_DRAFT_STATUSES as readonly string[]).includes(value)

export const DRAFT_STATUS_LABEL_KEYS: Record<ExpenseDraftStatusT, MessageKeyT<'expenseDrafts'>> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  rejected: 'statusRejected',
}

// The AI reads a draft in one call at send, so a draft never holds more pages than one call takes.
export const MAX_DRAFT_PAGES = MAX_RECEIPT_PAGES

export const DRAFT_ALREADY_DECIDED = pl.notices.draftAlreadyDecided
export const TOO_MANY_DRAFT_PAGES = pl.notices.tooManyPhotos
export const DRAFT_PAGES_NOT_ATTACHED = pl.notices.attachFailed
