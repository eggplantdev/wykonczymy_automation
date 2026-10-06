import { describe, it, expect } from 'vitest'
import { normalizeDocNumber, parseTelmak, plDateToIso } from '@/lib/telmak/parse-telmak'

// Line arrays in the shape `pdfLines` produces from a Telmak PDF (cells joined with ` | `). The
// buyer is invented; only Telmak's own NIP is real, because the parser rejects a page without it.
const SELLER = 'Sprzedawca | TELMAK Przykład | NIP: 526-23-86-109'
const BUYER = 'Nabywca | Firma Testowa Sp. z o.o. | ul. Zmyślona 1, 00-001 Nibylandia'

const wv = (): string[] => [
  'Wydanie zewnętrzne z VAT WV 4-00123/PRG/09/2026',
  'Data wystawienia | 02-09-2026',
  SELLER,
  BUYER,
  'Wartość brutto: | 1 234,56 PLN',
  'Razem do zapłaty: | 1 234,56 PLN',
  'Słownie do zapłaty: | jeden tysiąc dwieście trzydzieści cztery PLN 56/100',
  'Pozostało do zapłaty | 1 234,56 PLN',
  'Uwagi:',
  'Budowa testowa',
  'Wystawił(a): Jan Testowy',
]

const wz = (): string[] => [
  'Wydanie zewnętrzne WZ 4-07001/PRG/09/2026',
  'Data wystawienia | 03-09-2026',
  SELLER,
  BUYER,
  'Wartość brutto: | 200,00 PLN',
  'Razem do zapłaty: | 200,00 PLN',
  'Słownie do zapłaty: | dwieście PLN',
  'Uwagi:',
  'Wystawił(a): Jan Testowy',
]

const kwv = (): string[] => [
  'Korekta wydania zewnętrznego VAT KWV161/PRG/2026',
  'Data wystawienia | 10-09-2026',
  SELLER,
  BUYER,
  'Razem: | -40,65 | -9,35 | -50,00',
  'Razem do zwrotu: | 50,00 PLN',
  'Słownie do zwrotu: | pięćdziesiąt PLN',
  'Pozostało do zwrotu: | 50,00 PLN',
]

const fp = (): string[] => [
  'Faktura pro forma FP 141/PRG/09/2026',
  'Data wystawienia | 15-09-2026',
  SELLER,
  BUYER,
  'Wartość zamówienia | 3 000,00 PLN',
  'Słownie do zapłaty: | trzy tysiące PLN',
]

const replaceLine = (lines: string[], prefix: string, next: string) =>
  lines.map((l) => (l.startsWith(prefix) ? next : l))
const dropLine = (lines: string[], prefix: string) => lines.filter((l) => !l.startsWith(prefix))

describe('parseTelmak — document kinds', () => {
  it('reads a WV', () => {
    expect(parseTelmak(wv(), 'WV 4-00123_PRG_09_2026.pdf')).toEqual({
      fileName: 'WV 4-00123_PRG_09_2026.pdf',
      kind: 'WV',
      number: 'WV 4-00123/PRG/09/2026',
      date: '2026-09-02',
      amount: 1234.56,
      remark: 'Budowa testowa',
      problems: [],
    })
  })

  it('reads a WZ', () => {
    const doc = parseTelmak(wz(), 'wz.pdf')
    expect(doc).toMatchObject({ kind: 'WZ', number: 'WZ 4-07001/PRG/09/2026', amount: 200 })
    expect(doc.problems).toEqual([])
  })

  it('reads a KWV as a negative amount', () => {
    const doc = parseTelmak(kwv(), 'KWV161_PRG_2026.pdf')
    expect(doc).toMatchObject({
      kind: 'KWV',
      number: 'KWV161/PRG/2026',
      date: '2026-09-10',
      amount: -50,
    })
    expect(doc.problems).toEqual([])
  })

  it('reads an FP from „Wartość zamówienia”', () => {
    const doc = parseTelmak(fp(), 'fp.pdf')
    expect(doc).toMatchObject({ kind: 'FP', number: 'FP 141/PRG/09/2026', amount: 3000 })
    expect(doc.problems).toEqual([])
  })

  it('takes no remark when the line after „Uwagi:” is the signature', () => {
    expect(parseTelmak(wz(), 'wz.pdf').remark).toBeNull()
  })
})

describe('parseTelmak — rejections', () => {
  it('rejects an unknown document', () => {
    const doc = parseTelmak(['Faktura VAT 1/2026', SELLER], 'inna.pdf')
    expect(doc.kind).toBeNull()
    expect(doc.amount).toBeNull()
    expect(doc.problems).toContain('nie rozpoznano typu i numeru dokumentu')
  })

  it('rejects a page without the issue date', () => {
    expect(parseTelmak(dropLine(wv(), 'Data wystawienia'), 'a.pdf').problems).toEqual([
      'nie znaleziono daty wystawienia',
    ])
  })

  it('rejects a page without Telmak’s NIP', () => {
    expect(parseTelmak(dropLine(wv(), 'Sprzedawca'), 'a.pdf').problems).toEqual([
      'brak NIP-u Telmak (526-23-86-109)',
    ])
  })

  it('rejects a page without the total', () => {
    const doc = parseTelmak(dropLine(wv(), 'Razem do zapłaty'), 'a.pdf')
    expect(doc.amount).toBeNull()
    expect(doc.problems).toEqual(['nie znaleziono kwoty „Razem do zapłaty”'])
  })

  it('flags an amount in words it cannot read', () => {
    const lines = replaceLine(wv(), 'Słownie', 'Słownie do zapłaty: | tysiąc i coś PLN')
    expect(parseTelmak(lines, 'a.pdf').problems).toEqual(['nie odczytano kwoty słownie'])
  })

  it('flags an amount in words that disagrees with the total', () => {
    const lines = replaceLine(wv(), 'Słownie', 'Słownie do zapłaty: | jeden tysiąc PLN 56/100')
    expect(parseTelmak(lines, 'a.pdf').problems).toEqual([
      'kwota słownie (1000.56) ≠ kwota (1234.56)',
    ])
  })

  it('flags „Wartość brutto” that disagrees with the total', () => {
    const lines = replaceLine(wv(), 'Wartość brutto', 'Wartość brutto: | 1 000,00 PLN')
    expect(parseTelmak(lines, 'a.pdf').problems).toEqual(['„Wartość brutto” ≠ „Razem do zapłaty”'])
  })

  it('flags a KWV whose gross „Razem” disagrees with the refund', () => {
    const lines = replaceLine(kwv(), 'Razem: |', 'Razem: | -40,65 | -9,35 | -60,00')
    expect(parseTelmak(lines, 'a.pdf').problems).toEqual([
      '„Razem” brutto korekty ≠ „Razem do zwrotu”',
    ])
  })

  it('flags „Pozostało” larger than the document', () => {
    const lines = replaceLine(wv(), 'Pozostało', 'Pozostało do zapłaty | 2 000,00 PLN')
    expect(parseTelmak(lines, 'a.pdf').problems).toEqual(['„Pozostało” > kwota dokumentu'])
  })

  it('flags a file name that names another document', () => {
    expect(parseTelmak(wv(), 'WV 4-00999_PRG_09_2026.pdf').problems).toEqual([
      'numer w nazwie pliku (WV 4-00999/PRG/09/2026) ≠ numer w dokumencie (WV 4-00123/PRG/09/2026)',
    ])
  })
})

describe('normalizeDocNumber', () => {
  it('drops every whitespace and upper-cases', () => {
    expect(normalizeDocNumber(' wv 4-00123/PRG/09/2026 \n')).toBe('WV4-00123/PRG/09/2026')
  })

  it('maps a missing number to the empty string', () => {
    expect(normalizeDocNumber(null)).toBe('')
    expect(normalizeDocNumber(undefined)).toBe('')
  })
})

describe('plDateToIso', () => {
  it('reads dd.mm.yyyy and dd-mm-yyyy', () => {
    expect(plDateToIso('Telmak Kędzierski 02.10.2026')).toBe('2026-10-02')
    expect(plDateToIso('Telmak 02-10-2026')).toBe('2026-10-02')
  })

  it('returns null without a date', () => {
    expect(plDateToIso('Telmak')).toBeNull()
  })
})
