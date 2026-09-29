'use client'

import { useEngagedIds } from '@/hooks/use-engaged-ids'

// Per investment, like usePriceView and unlike the globally-keyed column hooks: a filter describes
// the state of one budowa, and carrying it to the next one would hide rows nobody chose to hide.
const STORAGE_KEY_PREFIX = 'kosztorys-filters:'

export function useEngagedConditions(investmentId: number) {
  return useEngagedIds(`${STORAGE_KEY_PREFIX}${investmentId}`)
}
