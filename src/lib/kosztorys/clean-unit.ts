import { foldUnit } from '@/lib/kosztorys/fold'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'

// Only ones the
// owner confirmed — a stray `2` or `180` is an ilość typed into the wrong column, not a j.m.
const UNIT_TYPO_FIXES: Readonly<Record<string, string>> = {
  klp: 'kpl',
  kp: 'kpl',
  n2: 'm2',
}

// Cleaning can't just return the fold: `foldUnit('m²')` is `m2`, but `m²` is what the combobox
// offers and the client's oferta prints, so the canonical spelling is keyed by its fold instead.
const CANONICAL_BY_FOLD = new Map(UNIT_SUGGESTIONS.map((unit) => [foldUnit(unit), unit]))

export function cleanUnit(unit: string): string {
  const trimmed = unit.replace(/\s+/g, ' ').trim()
  const folded = foldUnit(trimmed)
  return CANONICAL_BY_FOLD.get(UNIT_TYPO_FIXES[folded] ?? folded) ?? trimmed
}
