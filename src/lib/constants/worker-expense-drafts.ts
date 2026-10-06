import { pl } from '@/lib/i18n/dictionaries/pl'

export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

export const MAX_DRAFT_PAGES = 20

export const DRAFT_ALREADY_DECIDED = pl.notices.draftAlreadyDecided
export const TOO_MANY_DRAFT_PAGES = pl.notices.tooManyPhotos
export const DRAFT_PAGES_NOT_ATTACHED = pl.notices.attachFailed

// A rejection is undone soon or never, so the newest few are all the list has to reach.
export const REJECTED_DRAFTS_LIMIT = 20
