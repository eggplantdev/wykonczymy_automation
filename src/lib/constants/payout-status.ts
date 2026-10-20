export const PAYOUT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type PayoutStatusT = (typeof PAYOUT_STATUSES)[number]

export const isPayoutStatus = (value: unknown): value is PayoutStatusT =>
  (PAYOUT_STATUSES as readonly unknown[]).includes(value)
