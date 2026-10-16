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

export function fold(cell: unknown): string {
  return String(cell ?? '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => DIACRITICS[char] ?? char)
    .replace(/\s+/g, ' ')
    .trim()
}

const SUPERSCRIPT_DIGITS: Record<string, string> = { '¹': '1', '²': '2', '³': '3' }

// Deliberately NOT a typo dictionary: `klp` (38×) and `n2` (1×) stay separate from `kpl` and `m2`.
export function foldUnit(unit: unknown): string {
  return fold(unit)
    .replace(/[¹²³]/g, (char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .replace(/\./g, '')
    .trim()
}
