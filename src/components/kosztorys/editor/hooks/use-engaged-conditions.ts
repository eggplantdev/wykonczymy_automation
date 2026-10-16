'use client'

import { useEngagedIds } from '@/hooks/use-engaged-ids'

// a filter describes the state of one budowa, and carrying it to the next one would narrow rows nobody
// chose to narrow.
const STORAGE_KEY_PREFIX = 'kosztorys-show:'

const TEMPLATE_STORAGE_KEY_PREFIX = 'szablon-show:'

export function useEngagedConditions(investmentId: number, isTemplate = false) {
  // A szablon id and a kosztorys id share one number space.
  const prefix = isTemplate ? TEMPLATE_STORAGE_KEY_PREFIX : STORAGE_KEY_PREFIX
  return useEngagedIds(`${prefix}${investmentId}`)
}
