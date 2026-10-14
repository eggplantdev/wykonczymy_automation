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

export const MAX_DRAFT_PAGES = 8

export const OPEN_DRAFT_PARAM = 'zgloszenie'

export const DRAFT_ALREADY_DECIDED = pl.notices.draftAlreadyDecided

// A Radix Select value can't be empty, so „Bez inwestycji" needs a stand-in for its null id.
export const NO_INVESTMENT = 'none'
