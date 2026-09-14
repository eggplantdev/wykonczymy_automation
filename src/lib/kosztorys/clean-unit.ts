import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'

// Text cleanup for „j.m.", the sibling of `cleanDescription` and bound by the same contract: every
// rule is idempotent, so the owner can press the button as often as they like.

// Transposed letters, which no notation rule can reach — `foldUnit` reads `klp` and `kpl` as two
// different jednostki, so the same praca splits into two katalog entries carrying two prices.
//
// Only transpositions of a j.m. the data already uses. `n2` is NOT here: it reads like `m2`, but one
// neighbouring key on the keyboard is not evidence, and guessing it would silently reprice a praca.
// Same for `2` and `180`, which are ilości somebody typed into the j.m. column — a decision, not a
// literówka, and the katalog report is where they surface.
const UNIT_TYPO_FIXES: Readonly<Record<string, string>> = {
  klp: 'kpl',
  kp: 'kpl',
}

// The combobox's own list is the canonical spelling, keyed by what the matching makes of it. This is
// why cleaning cannot just return the fold: `foldUnit('m²')` is `m2`, but `m²` is what the cell
// offers and what the client's oferta prints — writing the fold back would retype the owner's j.m.
// into a form the app never suggests, and the next press would do it again.
const CANONICAL_BY_FOLD = new Map(UNIT_SUGGESTIONS.map((unit) => [foldUnit(unit), unit]))

/**
 * A j.m. off the canonical list keeps whatever the owner typed, case included — `Mg` and `kW` are
 * not shouting, and `big bag` is a real jednostka. Cleaning touches only what it can name.
 */
export function cleanUnit(unit: string): string {
  const trimmed = unit.replace(/\s+/g, ' ').trim()
  const folded = foldUnit(trimmed)
  return CANONICAL_BY_FOLD.get(UNIT_TYPO_FIXES[folded] ?? folded) ?? trimmed
}
