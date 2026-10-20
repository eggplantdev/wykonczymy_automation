// No `server-only` — the collection reads it inside the Payload CLI graph, the AI scripts under tsx.
export const INVESTMENT_MARKETS = ['primary', 'secondary'] as const

export type InvestmentMarketT = (typeof INVESTMENT_MARKETS)[number]

type LabelT = { pl: string; en: string }

const MARKET_LABELS: Record<InvestmentMarketT, LabelT> = {
  primary: { pl: 'Rynek pierwotny', en: 'Primary market' },
  secondary: { pl: 'Rynek wtórny', en: 'Secondary market' },
}

export const INVESTMENT_INITIAL_INFO_TITLE: LabelT = {
  pl: 'Wstępne informacje',
  en: 'Initial information',
}

export const INVESTMENT_INITIAL_INFO_FIELDS = {
  market: { label: { pl: 'Rynek', en: 'Market' }, options: MARKET_LABELS },
} satisfies Record<string, { label: LabelT; options?: Record<string, LabelT> }>
