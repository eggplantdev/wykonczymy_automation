// Not `Object.keys` of the labels map: that widens to `string[]`, and then `z.enum` and every
// `Record<InvestmentStatusT, …>` stop checking anything. Order is the lifecycle order the pickers show.
// No `server-only` — the collection reads it inside the Payload CLI graph.
export const INVESTMENT_STATUSES = ['quote', 'planowana', 'active', 'completed', 'szablon'] as const

export type InvestmentStatusT = (typeof INVESTMENT_STATUSES)[number]

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatusT, { pl: string; en: string }> = {
  quote: { pl: 'Wycena', en: 'Quote' },
  planowana: { pl: 'Planowana', en: 'Planned' },
  active: { pl: 'Aktywna', en: 'Active' },
  completed: { pl: 'Zakończona', en: 'Completed' },
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
] as const satisfies readonly InvestmentStatusT[]
