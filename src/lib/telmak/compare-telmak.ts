import { firstNoteLine } from '@/lib/utils/invoice-note'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { isWithinRange } from '@/lib/utils/date-range'
import { normalizeDocNumber, plDateToIso, type TelmakDocT } from '@/lib/telmak/parse-telmak'
import type { PreviewFileT } from '@/types/media'

export type TelmakAppRowT = {
  id: number
  amount: number
  description: string
  invoiceNote: string
  cancelled: boolean
  registerId: number | null
  registerName: string | null
  investmentName: string | null
  invoices: PreviewFileT[]
}

// Ordered by severity: the table sorts by it, and a document with several issues shows the worst.
const TELMAK_STATUSES = [
  'unreadable',
  'missing-in-app',
  'app-only',
  'amount',
  'date',
  'cancelled',
  'other-register',
  'no-file',
  'ok',
] as const

export type TelmakStatusT = (typeof TELMAK_STATUSES)[number]

export type TelmakResultRowT = {
  status: TelmakStatusT
  issues: string[]
  doc: TelmakDocT | null
  rows: TelmakAppRowT[]
  appAmount: number | null
  needsFile: TelmakAppRowT[]
}

export type TelmakCompareT = {
  results: TelmakResultRowT[]
  counts: { documents: number; appRows: number; ok: number; problems: number }
}

// The receipt scan writes „Telmak Kędzierski 02.10.2026" — the issue date, unlike `date`, which is
// the booking day.
const issueDateOf = (row: TelmakAppRowT) => plDateToIso(row.description)

const rank = (status: TelmakStatusT) => TELMAK_STATUSES.indexOf(status)
const rowDocNumber = (row: TelmakAppRowT) => normalizeDocNumber(firstNoteLine(row.invoiceNote))
const ids = (rows: TelmakAppRowT[]) => rows.map((r) => `#${r.id}`).join(', ')

function resultRow(
  status: TelmakStatusT,
  issues: string[],
  doc: TelmakDocT | null,
  rows: TelmakAppRowT[],
): TelmakResultRowT {
  const live = rows.filter((r) => !r.cancelled)
  return {
    status,
    issues,
    doc,
    rows,
    appAmount: live.length > 0 ? live.reduce((sum, r) => sum + r.amount, 0) : null,
    needsFile: live.filter((r) => r.invoices.length === 0),
  }
}

export function compareTelmak(
  docs: TelmakDocT[],
  appRows: TelmakAppRowT[],
  registerId: number,
  from: string,
  to: string,
): TelmakCompareT {
  const byNumber = new Map<string, TelmakAppRowT[]>()
  for (const row of appRows) {
    const key = rowDocNumber(row)
    if (!key) continue
    byNumber.set(key, [...(byNumber.get(key) ?? []), row])
  }

  const results: TelmakResultRowT[] = []
  const docKeys = new Set<string>()

  for (const doc of docs) {
    const key = normalizeDocNumber(doc.number)
    if (key) docKeys.add(key)
    const rows = byNumber.get(key) ?? []
    if (doc.problems.length > 0 || !key || doc.amount == null) {
      results.push(resultRow('unreadable', doc.problems, doc, rows))
      continue
    }
    if (rows.length === 0) {
      results.push(resultRow('missing-in-app', ['brak w aplikacji'], doc, rows))
      continue
    }

    const row = resultRow('ok', [], doc, rows)
    const live = rows.filter((r) => !r.cancelled)
    if (row.appAmount == null) {
      results.push({ ...row, status: 'cancelled', issues: ['tylko anulowana transakcja'] })
      continue
    }

    const issues: { status: TelmakStatusT; text: string }[] = []
    // A correction is booked as a negative CORRECTION, so its sign already matches the document.
    if (roundToCents(row.appAmount) !== roundToCents(doc.amount))
      issues.push({
        status: 'amount',
        text: `kwota: faktura ${formatPLN(doc.amount)}, aplikacja ${formatPLN(row.appAmount)}`,
      })
    const wrongDate = live.filter((r) => issueDateOf(r) !== doc.date)
    if (wrongDate.length > 0)
      issues.push({ status: 'date', text: `data w opisie ≠ ${doc.date} (${ids(wrongDate)})` })
    const elsewhere = live.filter((r) => r.registerId !== registerId)
    if (elsewhere.length > 0)
      issues.push({
        status: 'other-register',
        text: `w innej kasie: ${elsewhere.map((r) => `#${r.id} ${r.registerName ?? '—'}`).join(', ')}`,
      })
    if (row.needsFile.length > 0)
      issues.push({ status: 'no-file', text: `bez PDF: ${ids(row.needsFile)}` })

    const worst = issues.map((i) => i.status).sort((a, b) => rank(a) - rank(b))[0]
    results.push({ ...row, status: worst ?? 'ok', issues: issues.map((i) => i.text) })
  }

  const inRange = appRows.filter((r) => {
    const issued = issueDateOf(r)
    return (
      r.registerId === registerId &&
      !r.cancelled &&
      issued != null &&
      isWithinRange(issued, { from, to })
    )
  })
  for (const row of inRange) {
    const key = rowDocNumber(row)
    if (key && docKeys.has(key)) continue
    results.push(
      resultRow(
        'app-only',
        [key ? 'brak dokumentu w paczce' : 'brak numeru dokumentu w notatce'],
        null,
        [row],
      ),
    )
  }

  const ok = results.filter((r) => r.status === 'ok').length
  return {
    results: results.sort((a, b) => rank(a.status) - rank(b.status)),
    counts: { documents: docs.length, appRows: inRange.length, ok, problems: results.length - ok },
  }
}
