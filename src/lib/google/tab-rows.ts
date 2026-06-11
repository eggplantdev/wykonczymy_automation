import { getRelationName } from '@/lib/get-relation-name'
import {
  SHEET_TRANSFER_TAB_TYPES,
  TRANSFER_TYPE_LABELS,
  type SheetTransferTabTypeT,
} from '@/lib/constants/transfers'
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
}

// Row for the expenses tab (skip if it has no expense category → no typ).
export function expenseRow(t: TxDocT): TabRowInputT | undefined {
  const typ = getRelationName(t.expenseCategory, '')
  if (!typ) return undefined
  const amount = finiteAmount(t.amount)
  if (amount === undefined) {
    console.warn(`[sheets-sync] skip expense #${t.id}: non-finite amount ${String(t.amount)}`)
    return undefined
  }
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

const isTransferTabType = (t: unknown): t is SheetTransferTabTypeT =>
  (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(String(t))

// Row for the transfers tab: one of the six mirrored types → the 8-column shape.
// `worker` is PAYOUT context, `category` is CORRECTION context — blank otherwise.
export function transferRow(t: TxDocT): TabRowInputT | undefined {
  if (!isTransferTabType(t.type)) return undefined
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
