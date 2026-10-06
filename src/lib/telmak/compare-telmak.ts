import { firstNoteLine } from '@/lib/utils/invoice-note'
import { normalizeDocNumber, type TelmakDocT } from '@/lib/telmak/parse-telmak'
import type { PreviewFileT } from '@/types/media'

export type TelmakAppRowT = {
  id: number
  type: string
  amount: number
  description: string
  invoiceNote: string
  cancelled: boolean
  registerId: number | null
  registerName: string | null
  investmentName: string | null
  invoices: PreviewFileT[]
}

export type TelmakStatusT =
  | 'unreadable'
  | 'missing-in-app'
  | 'amount'
  | 'date'
  | 'cancelled'
  | 'other-register'
  | 'no-file'
  | 'app-only'
  | 'ok'

export type TelmakResultRowT = {
  status: TelmakStatusT
  issues: string[]
  doc: TelmakDocT | null
  rows: TelmakAppRowT[]
}

export type TelmakCompareT = {
  results: TelmakResultRowT[]
  counts: { documents: number; appRows: number; ok: number; problems: number }
}

// The receipt scan writes „Telmak Kędzierski 02.10.2026" — the issue date, unlike `date`, which is
// the booking day.
export function issueDateOf(description: string): string | null {
  const m = description.match(/(\d{2})[.-](\d{2})[.-](\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const sameMoney = (a: number, b: number) => Math.abs(a - b) < 0.005
const pln = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł'

export function compareTelmak(
  docs: TelmakDocT[],
  appRows: TelmakAppRowT[],
  registerId: number,
  from: string,
  to: string,
): TelmakCompareT {
  const byNumber = new Map<string, TelmakAppRowT[]>()
  for (const row of appRows) {
    const key = normalizeDocNumber(firstNoteLine(row.invoiceNote))
    if (!key) continue
    byNumber.set(key, [...(byNumber.get(key) ?? []), row])
  }

  const results: TelmakResultRowT[] = []
  const docKeys = new Set<string>()

  for (const doc of docs) {
    if (doc.problems.length > 0 || !doc.number || doc.amount == null) {
      results.push({ status: 'unreadable', issues: doc.problems, doc, rows: [] })
      continue
    }
    const key = normalizeDocNumber(doc.number)
    docKeys.add(key)
    const rows = byNumber.get(key) ?? []
    const live = rows.filter((r) => !r.cancelled)

    if (rows.length === 0) {
      results.push({ status: 'missing-in-app', issues: ['brak w aplikacji'], doc, rows })
      continue
    }
    if (live.length === 0) {
      results.push({ status: 'cancelled', issues: ['tylko anulowana transakcja'], doc, rows })
      continue
    }

    const issues: { status: TelmakStatusT; text: string }[] = []
    const total = live.reduce((sum, r) => sum + r.amount, 0)
    // A correction is booked as a negative CORRECTION, so its sign already matches the document.
    if (!sameMoney(Math.abs(total), Math.abs(doc.amount)))
      issues.push({
        status: 'amount',
        text: `kwota: faktura ${pln(doc.amount)}, aplikacja ${pln(total)}`,
      })
    const wrongDate = live.filter((r) => issueDateOf(r.description) !== doc.date)
    if (wrongDate.length > 0)
      issues.push({
        status: 'date',
        text: `data w opisie ≠ ${doc.date} (${wrongDate.map((r) => `#${r.id}`).join(', ')})`,
      })
    const elsewhere = live.filter((r) => r.registerId !== registerId)
    if (elsewhere.length > 0)
      issues.push({
        status: 'other-register',
        text: `w innej kasie: ${elsewhere.map((r) => `#${r.id} ${r.registerName ?? '—'}`).join(', ')}`,
      })
    const noFile = live.filter((r) => r.invoices.length === 0)
    if (noFile.length > 0)
      issues.push({
        status: 'no-file',
        text: `bez PDF: ${noFile.map((r) => `#${r.id}`).join(', ')}`,
      })

    results.push({
      status: issues[0]?.status ?? 'ok',
      issues: issues.map((i) => i.text),
      doc,
      rows,
    })
  }

  const inRange = appRows.filter((r) => {
    const issued = issueDateOf(r.description)
    return (
      r.registerId === registerId &&
      !r.cancelled &&
      issued != null &&
      issued >= from &&
      issued <= to
    )
  })
  for (const row of inRange) {
    const key = normalizeDocNumber(firstNoteLine(row.invoiceNote))
    if (key && docKeys.has(key)) continue
    results.push({
      status: 'app-only',
      issues: [key ? 'brak dokumentu w paczce' : 'brak numeru dokumentu w notatce'],
      doc: null,
      rows: [row],
    })
  }

  const ok = results.filter((r) => r.status === 'ok').length
  return {
    results: results.sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    ),
    counts: { documents: docs.length, appRows: inRange.length, ok, problems: results.length - ok },
  }
}

const STATUS_ORDER: TelmakStatusT[] = [
  'unreadable',
  'missing-in-app',
  'app-only',
  'amount',
  'date',
  'cancelled',
  'other-register',
  'no-file',
  'ok',
]
