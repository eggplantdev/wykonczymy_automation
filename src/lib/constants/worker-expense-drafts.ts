import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import { pl } from '@/lib/i18n/dictionaries/pl'

export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

// The AI reads a draft in one call at send, so a draft never holds more pages than one call takes.
export const MAX_DRAFT_PAGES = MAX_RECEIPT_PAGES

export const DRAFT_ALREADY_DECIDED = pl.notices.draftAlreadyDecided
export const TOO_MANY_DRAFT_PAGES = pl.notices.tooManyPhotos
export const DRAFT_PAGES_NOT_ATTACHED = pl.notices.attachFailed

// A rejection is undone soon or never, so the newest few are all the list has to reach.
export const REJECTED_DRAFTS_LIMIT = 20
