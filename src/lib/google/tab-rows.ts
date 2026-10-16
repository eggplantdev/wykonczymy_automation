import { getRelationName } from '@/lib/utils/get-relation-name'
import {
  billsNetAmount,
  isSheetTransferTabType,
  TRANSFER_TYPE_LABELS,
} from '@/lib/constants/transfers'
import type { TabRowInputT } from './sheets'

// a `new Date(...).toISOString()` round-trip converts to UTC and can land the date a day early
// for a just-after-midnight local time.
const isoDate = (d: unknown): string => {
  if (!d) return ''
  const match = String(d).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : new Date(d as string).toISOString().slice(0, 10)
}

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
  netAmount?: number | string | null
  type?: string
  date?: string | null
  description?: string | null
  invoiceNote?: string | null
  expenseCategory?: unknown
  otherCategory?: unknown
  worker?: unknown
  settled?: boolean
}

function buildExpenseRow(
  t: TxDocT,
  transform: (typ: string, amount: number) => { typ: string; amount: number },
): TabRowInputT | undefined {
  const baseTyp = getRelationName(t.expenseCategory, '')
  if (!baseTyp) return undefined // no expense category → no typ → skip
  // Mirroring brutto here would put the owner's VAT reclaim on the client's invoice and leave the
  // sheet's Σ above the app's materiały.
  const billed = billsNetAmount(t.type) ? t.netAmount : t.amount
  const baseAmount = finiteAmount(billed)
  if (baseAmount === undefined) {
    console.warn(`[sheets-sync] skip expense #${t.id}: non-finite amount ${String(billed)}`)
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

export function expenseRow(t: TxDocT): TabRowInputT | undefined {
  return buildExpenseRow(t, (typ, amount) =>
    t.settled ? { typ: `${typ} rozliczone`, amount: 0 } : { typ, amount },
  )
}

export function settledExpenseRow(t: TxDocT): TabRowInputT | undefined {
  if (!t.settled) return undefined
  return buildExpenseRow(t, (typ, amount) => ({ typ, amount }))
}

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
