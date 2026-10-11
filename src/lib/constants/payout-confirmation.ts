export const PAYOUT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type PayoutStatusT = (typeof PAYOUT_STATUSES)[number]

export const isPayoutStatus = (value: unknown): value is PayoutStatusT =>
  (PAYOUT_STATUSES as readonly unknown[]).includes(value)

// A worker opens his page every 2–4 weeks; a cancellation must still be there when he does.
export const CANCELLED_PAYOUT_VISIBLE_DAYS = 14
