import type { PriceSourceT, ToolPlaneT } from '@/lib/kosztorys/types'

export const PLANE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: 'Z narzędziami (podwykonawca)',
  own_tools: 'Bez narzędzi (pracownik)',
}

export const RATE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: `Stawka ${PLANE_LABELS.w_tools.toLowerCase()}`,
  own_tools: `Stawka ${PLANE_LABELS.own_tools.toLowerCase()}`,
}

// The Polish names of the trzy źródła stawki wykonawcy (`PRICE_SOURCES`). Labels name the ŹRÓDŁO,
// not the arithmetic.
export const PRICE_SOURCE_LABELS: Record<PriceSourceT, string> = {
  auto: 'auto',
  coeff: 'własny mnożnik',
  amount: 'kwota stała',
}

// The three figures of the subcontractor settlement, named once. The headline block reads them as row
// labels and the per-worker table as column headers — the same three amounts, so a reader must never
// have to work out that „Należne" and „Suma wykonanej pracy" were the same thing.
export const SUBCONTRACTOR_FIGURE_LABELS = {
  due: 'Suma wykonanej pracy',
  payouts: 'Zaliczki (wypłaty)',
  remaining: 'Pozostało do wypłaty',
} as const
