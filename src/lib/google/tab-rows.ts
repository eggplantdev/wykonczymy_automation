import { getRelationName } from '@/lib/get-relation-name'
import { isSheetTransferTabType, TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import type { TabRowInputT } from './sheets'

// Pure transaction-doc → sheet-row builders, split out of sheets-sync.ts because
// that module is 'use server' (it may only export async server actions) and these
// must stay unit-testable.

// Payload stores dates as ISO strings (e.g. "2026-05-27T00:00:00.000Z"). Slice the
// leading YYYY-MM-DD directly — a `new Date(...).toISOString()` round-trip converts
// to UTC and can land the date a day early for a just-after-midnight local time.
const isoDate = (d: unknown): string => {
  if (!d) return ''
  const match = String(d).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : new Date(d as string).toISOString().slice(0, 10)
}

// Coerce a payload amount (number | string) to a finite number, or undefined if it
// can't be one. Guards against Number('')→0 (silently wrong) and Number('x')→NaN
// (serialized to the sheet as text), both of which would corrupt the SUMIF totals.
const finiteAmount = (raw: unknown): number | undefined => {
  // Number('') and Number('   ') both coerce to 0 — reject blanks first so they
  // can't masquerade as a finite zero amount.
  if (raw == null) return undefined
  if (typeof raw === 'string' && raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export type TxDocT = {
  id: number
  amount: number | string
  type?: string
  date?: string | null
  description?: string | null
  invoiceNote?: string | null
  expenseCategory?: unknown
  otherCategory?: unknown
  worker?: unknown
  settled?: boolean
}

// Shared body for both expense tabs: the category→typ guard, the finite-amount guard
// (+ skip-warn), and the identical 7-field shape. Only `typ`/`amount` differ per tab,
// so each caller passes a transform over the validated (typ, amount).
function buildExpenseRow(
  t: TxDocT,
  transform: (typ: string, amount: number) => { typ: string; amount: number },
): TabRowInputT | undefined {
  const baseTyp = getRelationName(t.expenseCategory, '')
  if (!baseTyp) return undefined // no expense category → no typ → skip
  const baseAmount = finiteAmount(t.amount)
  if (baseAmount === undefined) {
    console.warn(`[sheets-sync] skip expense #${t.id}: non-finite amount ${String(t.amount)}`)
    return undefined
  }
  const { typ, amount } = transform(baseTyp, baseAmount)
  return {
    transferId: t.id,
    date: isoDate(t.date),
    typ,
    description: t.description ?? '',
    amount,
    category: getRelationName(t.otherCategory, ''),
    note: t.invoiceNote ?? '',
  }
}

// Row for the bill tab. A settled expense ("wliczone w robociznę") is absorbed by the
// company, not billed to the client: column-E amount is 0 so client SUM(E:E)/SUMIF
// exclude it, and the type is suffixed " rozliczone" to mark the 0-cost line. The real
// amount is mirrored on the separate "rozliczone R+M" tab (settledExpenseRow), not here.
export function expenseRow(t: TxDocT): TabRowInputT | undefined {
  return buildExpenseRow(t, (typ, amount) =>
    t.settled ? { typ: `${typ} rozliczone`, amount: 0 } : { typ, amount },
  )
}

// Row for the separate "rozliczone R+M" tab: settled expenses at their REAL amount, plain
// category in `typ` (the tab name already says these are settled). The sync feeds it only
// settled rows; the guard is defensive. Mirrors the pre-billing-fix expense row.
export function settledExpenseRow(t: TxDocT): TabRowInputT | undefined {
  if (!t.settled) return undefined
  return buildExpenseRow(t, (typ, amount) => ({ typ, amount }))
}

// Row for the transfers tab: one of the six mirrored types → the 8-column shape.
// `worker` is PAYOUT context, `category` is CORRECTION context — blank otherwise.
export function transferRow(t: TxDocT): TabRowInputT | undefined {
  if (!isSheetTransferTabType(t.type)) return undefined
  const amount = finiteAmount(t.amount)
  if (amount === undefined) {
    console.warn(`[sheets-sync] skip transfer #${t.id}: non-finite amount ${String(t.amount)}`)
    return undefined
  }
  return {
    transferId: t.id,
    date: isoDate(t.date),
    typ: TRANSFER_TYPE_LABELS[t.type],
    description: t.description ?? '',
    amount,
    worker: getRelationName(t.worker, ''),
    category: getRelationName(t.expenseCategory, '') || getRelationName(t.otherCategory, ''),
    note: t.invoiceNote ?? '',
  }
}
