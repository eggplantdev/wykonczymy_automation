// Not `Object.keys` of the labels map: that widens to `string[]`, and then `z.enum` and every
// `Record<InvestmentStatusT, …>` stop checking anything.
// No `server-only` — the collection reads it inside the Payload CLI graph.
export const INVESTMENT_STATUSES = [
  'quote',
  'planowana',
  'active',
  'completed',
  'rejected',
  'szablon',
] as const

export type InvestmentStatusT = (typeof INVESTMENT_STATUSES)[number]

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatusT, { pl: string; en: string }> = {
  quote: { pl: 'Wycena', en: 'Quote' },
  planowana: { pl: 'Planowana', en: 'Planned' },
  active: { pl: 'Aktywna', en: 'Active' },
  completed: { pl: 'Zakończona', en: 'Completed' },
  rejected: { pl: 'Odrzucona', en: 'Rejected' },
  szablon: { pl: 'Szablon', en: 'Template' },
}

export const PICKABLE_INVESTMENT_STATUSES = [
  'quote',
  'planowana',
  'active',
  'completed',
  'rejected',
] as const satisfies readonly InvestmentStatusT[]

export const CLOSED_INVESTMENT_STATUSES = [
  'completed',
  'rejected',
] as const satisfies readonly InvestmentStatusT[]

export const isClosedStatus = (status: string): boolean =>
  (CLOSED_INVESTMENT_STATUSES as readonly string[]).includes(status)
