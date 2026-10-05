export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

export const EXPENSE_DRAFT_STATUS_LABELS: Record<ExpenseDraftStatusT, string> = {
  pending: 'czeka',
  accepted: 'przyjęty',
  rejected: 'odrzucony',
}

export const MAX_DRAFT_PAGES = 20

export const DRAFT_ALREADY_DECIDED = 'To zgłoszenie zostało już rozpatrzone.'
export const TOO_MANY_DRAFT_PAGES = 'Za dużo zdjęć w jednym zgłoszeniu'
export const DRAFT_PAGES_NOT_ATTACHED = 'Nie udało się dołączyć zdjęć'

// A rejection is undone soon or never, so the newest few are all the list has to reach.
export const REJECTED_DRAFTS_LIMIT = 20
