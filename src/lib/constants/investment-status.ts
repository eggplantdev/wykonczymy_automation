// Not `Object.keys` of the labels map: that widens to `string[]`, and then `z.enum` and every
// `Record<InvestmentStatusT, …>` stop checking anything. Order is the lifecycle order the pickers show.
// No `server-only` — the collection reads it inside the Payload CLI graph.
export const INVESTMENT_STATUSES = ['quote', 'planowana', 'active', 'completed', 'rejected', 'szablon'] as const

export type InvestmentStatusT = (typeof INVESTMENT_STATUSES)[number]

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatusT, { pl: string; en: string }> = {
  quote: { pl: 'Wycena', en: 'Quote' },
  planowana: { pl: 'Planowana', en: 'Planned' },
  active: { pl: 'Aktywna', en: 'Active' },
  completed: { pl: 'Zakończona', en: 'Completed' },
  rejected: { pl: 'Odrzucona', en: 'Rejected' },
  szablon: { pl: 'Szablon', en: 'Template' },
}

// `szablon` is left out: a szablon is born only through createTemplate
// (src/lib/kosztorys/create-template.ts), and guardTemplateStatus keeps the value from being set or
// dropped on an update.
export const PICKABLE_INVESTMENT_STATUSES = [
  'quote',
  'planowana',
  'active',
  'completed',
  'rejected',
] as const satisfies readonly InvestmentStatusT[]

// Owner rulings: Planowana stays (money is booked on planned work, 2026-10-15); Wycena is out pending
// the owner's decision (EX-1066). A status set, not the ref's `active` flag — widening that flag
// would leak Planowana into every other „aktywne” picker and count. The server still refuses only
// Zakończona; this only decides what a booking form offers.
export const BOOKING_PICKER_STATUSES = [
  'active',
  'planowana',
] as const satisfies readonly InvestmentStatusT[]

export function isOfferedForBooking(investment: { status: string }): boolean {
  return (BOOKING_PICKER_STATUSES as readonly string[]).includes(investment.status)
}
