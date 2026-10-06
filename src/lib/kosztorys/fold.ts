const DIACRITICS: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
}

// Stricter than `@/lib/google/sheet-configs`'s `normalize`, which only trims and lowercases. These
// headers are hand-typed by the owner over years, and the same sheet spells one banner „cennik z
// narzędziami" on one tab and „cennik z narzedziami" on another. Folding diacritics and collapsing
// internal whitespace is what makes those the same string. The shared `normalize` is left alone —
// it governs the tabs this app WRITES, where the headers are ours and exact matching is a feature.
export function fold(cell: unknown): string {
  return String(cell ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => DIACRITICS[char] ?? char)
    .replace(/\s+/g, ' ')
    .trim()
}

const SUPERSCRIPT_DIGITS: Record<string, string> = { '¹': '1', '²': '2', '³': '3' }

// The j.m. member of a praca's identity, folded harder than `fold()` because a unit is an
// abbreviation and the owner abbreviates it inconsistently across sheets and years: `szt` / `szt.`,
// `mb` / `m.b.`, `m2` / `m²`. Left as `fold()` alone those are distinct units, so the same praca
// arrives from two sheets as two catalogue entries — and the second one carries a price nobody
// compared against the first.
//
// Deliberately NOT a typo dictionary: `klp` (38×) and `n2` (1×) stay separate from `kpl` and `m2`.
// Guessing that a letter was mistyped decides a praca's price on the strength of a hunch; the report
// flags them instead and a human decides. Same reason the description half is not fuzzy-matched.
export function foldUnit(unit: unknown): string {
  return fold(unit)
    .replace(/[¹²³]/g, (char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .replace(/\./g, '')
    .trim()
}
