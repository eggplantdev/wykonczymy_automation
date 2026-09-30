import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'

// The rozpiska's own units join the canonical list, so a „m3" or „godz" it already uses is on
// offer; an older entry keeps its unit even if neither list has it.
export function unitOptions(commonUnits: readonly string[], current: string): string[] {
  return [...new Set([...UNIT_SUGGESTIONS, ...commonUnits.map(cleanUnit), current].filter(Boolean))]
}
