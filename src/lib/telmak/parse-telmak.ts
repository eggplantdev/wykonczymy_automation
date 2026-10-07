import { wordsToAmount } from '@/lib/telmak/words-to-amount'

// Every redundant figure on the page is cross-checked, so a layout change surfaces as an explicit
// rejection reason instead of a wrong number.
const TELMAK_NIP = '5262386109'

type TelmakKindT = 'WV' | 'KWV' | 'WZ' | 'FP'

export type TelmakDocT = {
  fileName: string
  kind: TelmakKindT | null
  number: string | null
  date: string | null
  amount: number | null
  remark: string | null
  problems: string[]
}

type KindT = { re: RegExp; kind: TelmakKindT; total: string; left: string; sign: 1 | -1 }

const KINDS: KindT[] = [
  {
    re: /^Korekta wydania zewnętrznego VAT (\S+)/,
    kind: 'KWV',
    total: 'Razem do zwrotu:',
    left: 'Pozostało do zwrotu:',
    sign: -1,
  },
  {
    re: /^Wydanie zewnętrzne z VAT (WV \S+)/,
    kind: 'WV',
    total: 'Razem do zapłaty:',
    left: 'Pozostało do zapłaty',
    sign: 1,
  },
  {
    re: /^Wydanie zewnętrzne (WZ \S+)/,
    kind: 'WZ',
    total: 'Razem do zapłaty:',
    left: 'Pozostało do zapłaty',
    sign: 1,
  },
  {
    re: /^Faktura pro forma (FP \S+)/,
    kind: 'FP',
    total: 'Wartość zamówienia',
    left: 'Pozostało do zapłaty',
    sign: 1,
  },
]

const money = (s: string) => Number(s.replace(/PLN|[\s\u00a0]/g, '').replace(',', '.'))

// Telmak prints dates as dd-mm-yyyy, the receipt scan as dd.mm.yyyy.
export function plDateToIso(text: string): string | null {
  const m = text.match(/(\d{2})[.-](\d{2})[.-](\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

export function unreadableDoc(fileName: string, problem: string): TelmakDocT {
  return {
    fileName,
    kind: null,
    number: null,
    date: null,
    amount: null,
    remark: null,
    problems: [problem],
  }
}

function field(lines: string[], label: string): string | null {
  for (const line of lines) {
    const cells = line.split(' | ')
    const at = cells.findIndex((c) => c.trim() === label)
    if (at !== -1 && cells[at + 1]) return cells[at + 1].trim()
  }
  return null
}

export function normalizeDocNumber(number: string | null | undefined): string {
  return (number ?? '').replace(/\s+/g, '').toUpperCase()
}

export function parseTelmak(lines: string[], fileName: string): TelmakDocT {
  const problems: string[] = []
  let head: { spec: KindT; number: string } | null = null
  for (const line of lines) {
    for (const spec of KINDS) {
      const m = line.match(spec.re)
      if (m) {
        head = { spec, number: m[1] }
        break
      }
    }
    if (head) break
  }
  const spec = head?.spec ?? null
  const kind = spec?.kind ?? null
  const number = head?.number ?? null
  if (!head) problems.push('nie rozpoznano typu i numeru dokumentu')

  const date = plDateToIso(field(lines, 'Data wystawienia') ?? '')
  if (!date) problems.push('nie znaleziono daty wystawienia')

  if (!lines.some((l) => l.replace(/\D/g, '').includes(TELMAK_NIP)))
    problems.push('brak NIP-u Telmak (526-23-86-109)')

  let amount: number | null = null
  const raw = spec ? field(lines, spec.total) : null
  if (spec && raw?.endsWith('PLN')) amount = spec.sign * money(raw)
  else if (spec) problems.push(`nie znaleziono kwoty „${spec.total.replace(':', '')}”`)

  if (spec && amount != null) {
    const words = field(lines, 'Słownie do zapłaty:') ?? field(lines, 'Słownie do zwrotu:')
    const spelled = words ? wordsToAmount(words) : null
    if (spelled == null) problems.push('nie odczytano kwoty słownie')
    else if (spelled !== Math.abs(amount))
      problems.push(`kwota słownie (${spelled}) ≠ kwota (${Math.abs(amount)})`)

    if (kind === 'WV' || kind === 'WZ') {
      const gross = field(lines, 'Wartość brutto:')
      if (!gross || money(gross) !== amount) problems.push('„Wartość brutto” ≠ „Razem do zapłaty”')
    }
    if (kind === 'KWV') {
      const sum = lines
        .find((l) => l.startsWith('Razem: |'))
        ?.split(' | ')
        .at(-1)
      if (!sum || money(sum) !== amount) problems.push('„Razem” brutto korekty ≠ „Razem do zwrotu”')
    }
    const left = field(lines, spec.left)
    if (left && Math.abs(money(left)) > Math.abs(amount))
      problems.push('„Pozostało” > kwota dokumentu')
  }

  const fromName = fileName.replace(/\.pdf$/i, '').replace(/_/g, '/')
  if (
    number &&
    /^(WV|WZ|FP|KWV)/.test(fromName) &&
    normalizeDocNumber(fromName) !== normalizeDocNumber(number)
  )
    problems.push(`numer w nazwie pliku (${fromName}) ≠ numer w dokumencie (${number})`)

  // Without a remark the next line is the signature block, not a remark.
  const remarkAt = lines.indexOf('Uwagi:')
  const remark = remarkAt === -1 ? null : (lines[remarkAt + 1] ?? null)
  return {
    fileName,
    kind,
    number,
    date,
    amount,
    remark: remark && !remark.startsWith('Wystawił') ? remark : null,
    problems,
  }
}
