// No `server-only` — the collection reads it inside the Payload CLI graph.
export const INVESTMENT_CLIENT_TYPES = ['person', 'company'] as const

export type InvestmentClientTypeT = (typeof INVESTMENT_CLIENT_TYPES)[number]

export const INVESTMENT_CLIENT_TYPE_LABELS: Record<
  InvestmentClientTypeT,
  { pl: string; en: string }
> = {
  person: { pl: 'Osoba prywatna', en: 'Private person' },
  company: { pl: 'Firma', en: 'Company' },
}
