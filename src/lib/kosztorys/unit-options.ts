import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'

export function unitOptions(commonUnits: readonly string[], current: string): string[] {
  return [...new Set([...UNIT_SUGGESTIONS, ...commonUnits.map(cleanUnit), current].filter(Boolean))]
}
