'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'

// Whether investment expenses (materiały) are priced at netto — brutto − VAT — on the netto axis,
// versus kept at their raw brutto amount (netto = brutto). Persisted globally in localStorage: a
// reading preference of the person, same `table-columns:` family as the money-axis / panel pickers.
// Default `net` preserves the historical behaviour (materiały netto derived by removing VAT).
const STORAGE_KEY = 'table-columns:kosztorys-materials-net'
const STATES = ['net', 'brutto'] as const

export function useMaterialsNetPricing(): [boolean, (deriveNet: boolean) => void] {
  const [state, setState] = usePersistedEnum(STORAGE_KEY, STATES, 'net')
  return [state === 'net', (deriveNet) => setState(deriveNet ? 'net' : 'brutto')]
}
