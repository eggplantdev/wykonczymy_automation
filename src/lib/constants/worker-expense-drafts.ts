import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import { pl } from '@/lib/i18n/dictionaries/pl'

export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

export const isExpenseDraftStatus = (value: string): value is ExpenseDraftStatusT =>
  (EXPENSE_DRAFT_STATUSES as readonly string[]).includes(value)

export const SERVER_SORTABLE_DRAFT_COLUMNS = [
  'workerName',
  'investmentName',
  'sentAt',
  'status',
  'decidedAt',
] as const

export type ServerSortableDraftColumnT = (typeof SERVER_SORTABLE_DRAFT_COLUMNS)[number]

export function isServerSortableDraftColumn(
  columnId: string,
): columnId is ServerSortableDraftColumnT {
  return (SERVER_SORTABLE_DRAFT_COLUMNS as readonly string[]).includes(columnId)
}

// The AI reads a draft in one call at send, so a draft never holds more pages than one call takes.
export const MAX_DRAFT_PAGES = MAX_RECEIPT_PAGES

export const DRAFT_ALREADY_DECIDED = pl.notices.draftAlreadyDecided
export const TOO_MANY_DRAFT_PAGES = pl.notices.tooManyPhotos
export const DRAFT_PAGES_NOT_ATTACHED = pl.notices.attachFailed
