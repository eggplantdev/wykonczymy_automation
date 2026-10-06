// Telmak document parser: every field is required and every redundant figure on the page is
// cross-checked, so a layout change surfaces as an explicit rejection reason instead of a wrong number.
const TELMAK_NIP = '5262386109'

export type TelmakKindT = 'WV' | 'KWV' | 'WZ' | 'FP'

export type TelmakDocT = {
  fileName: string
  kind: TelmakKindT | null
  number: string | null
  date: string | null
  amount: number | null
  remark: string | null
  problems: string[]
}

const KINDS: { re: RegExp; kind: TelmakKindT }[] = [
  { re: /^Korekta wydania zewnętrznego VAT (\S+)/, kind: 'KWV' },
  { re: /^Wydanie zewnętrzne z VAT (WV \S+)/, kind: 'WV' },
  { re: /^Wydanie zewnętrzne (WZ \S+)/, kind: 'WZ' },
  { re: /^Faktura pro forma (FP \S+)/, kind: 'FP' },
]

const UNITS: Record<string, number> = {
  zero: 0,
  jeden: 1,
  jedna: 1,
  dwa: 2,
  dwie: 2,
  trzy: 3,
  cztery: 4,
  pięć: 5,
  sześć: 6,
  siedem: 7,
  osiem: 8,
  dziewięć: 9,
  dziesięć: 10,
  jedenaście: 11,
  dwanaście: 12,
  trzynaście: 13,
  czternaście: 14,
  piętnaście: 15,
  szesnaście: 16,
  siedemnaście: 17,
  osiemnaście: 18,
  dziewiętnaście: 19,
  dwadzieścia: 20,
  trzydzieści: 30,
  czterdzieści: 40,
  pięćdziesiąt: 50,
  sześćdziesiąt: 60,
  siedemdziesiąt: 70,
  osiemdziesiąt: 80,
  dziewięćdziesiąt: 90,
  sto: 100,
  dwieście: 200,
  trzysta: 300,
  czterysta: 400,
  pięćset: 500,
  sześćset: 600,
  siedemset: 700,
  osiemset: 800,
  dziewięćset: 900,
}

export function wordsToAmount(text: string): number | null {
  const m = text.match(/^(.*?)\s*PLN(?:\s+(\d{1,2})\/100)?$/)
  if (!m) return null
  let total = 0
  let chunk = 0
  for (const w of m[1].toLowerCase().split(/\s+/).filter(Boolean)) {
    if (w in UNITS) chunk += UNITS[w]
    else if (/^tysi(ąc|ące|ęcy)$/.test(w)) {
      total += (chunk || 1) * 1000
      chunk = 0
    } else return null
  }
  return Math.round((total + chunk) * 100 + Number(m[2] ?? 0)) / 100
}

const money = (s: string) => Number(s.replace(/[\s\u00a0]/g, '').replace(',', '.'))

// The value is the cell right after the label cell, wherever on the line the label sits.
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
  let head: { kind: TelmakKindT; number: string } | null = null
  for (const line of lines) {
    for (const k of KINDS) {
      const m = line.match(k.re)
      if (m) {
        head = { kind: k.kind, number: m[1] }
        break
      }
    }
    if (head) break
  }
  const kind = head?.kind ?? null
  const number = head?.number ?? null
  if (!head) problems.push('nie rozpoznano typu i numeru dokumentu')

  const dm = lines
    .find((l) => l.includes('Data wystawienia'))
    ?.match(/Data wystawienia \| (\d{2})-(\d{2})-(\d{4})/)
  const date = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null
  if (!date) problems.push('nie znaleziono daty wystawienia')

  if (!lines.some((l) => l.replace(/\D/g, '').includes(TELMAK_NIP)))
    problems.push('brak NIP-u Telmak (526-23-86-109)')

  let amount: number | null = null
  const totalLabel =
    kind === 'KWV' ? 'Razem do zwrotu:' : kind === 'FP' ? 'Wartość zamówienia' : 'Razem do zapłaty:'
  const raw = kind ? field(lines, totalLabel) : null
  if (raw?.endsWith('PLN')) amount = money(raw.replace('PLN', ''))
  else if (kind) problems.push(`nie znaleziono kwoty „${totalLabel.replace(':', '')}”`)
  if (amount != null && kind === 'KWV') amount = -amount

  if (amount != null) {
    const words = field(lines, 'Słownie do zapłaty:') ?? field(lines, 'Słownie do zwrotu:')
    const spelled = words ? wordsToAmount(words) : null
    if (spelled == null) problems.push('nie odczytano kwoty słownie')
    else if (spelled !== Math.abs(amount))
      problems.push(`kwota słownie (${spelled}) ≠ kwota (${Math.abs(amount)})`)

    if (kind === 'WV' || kind === 'WZ') {
      const gross = field(lines, 'Wartość brutto:')
      if (!gross || money(gross.replace('PLN', '')) !== amount)
        problems.push('„Wartość brutto” ≠ „Razem do zapłaty”')
    }
    if (kind === 'KWV') {
      const sum = lines
        .find((l) => l.startsWith('Razem: |'))
        ?.split(' | ')
        .at(-1)
      if (!sum || money(sum) !== amount) problems.push('„Razem” brutto korekty ≠ „Razem do zwrotu”')
    }
    const left = field(lines, kind === 'KWV' ? 'Pozostało do zwrotu:' : 'Pozostało do zapłaty')
    if (left && Math.abs(money(left.replace('PLN', ''))) > Math.abs(amount))
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
