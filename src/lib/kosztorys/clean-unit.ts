import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'

// Text cleanup for „j.m.", sibling of `cleanDescription`: every rule is idempotent, so the owner
// can press the button as often as they like.

// Transposed letters `foldUnit` can't reach (`klp`/`kpl` split one praca's katalog entry in two).
// Only known transpositions — `n2`/`m2` and stray `2`/`180` are deliberate ilości, not typos, and
// the katalog report is where those surface instead.
const UNIT_TYPO_FIXES: Readonly<Record<string, string>> = {
  klp: 'kpl',
  kp: 'kpl',
}

// Cleaning can't just return the fold: `foldUnit('m²')` is `m2`, but `m²` is what the combobox
// offers and the client's oferta prints, so the canonical spelling is keyed by its fold instead.
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
