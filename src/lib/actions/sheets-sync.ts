'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  applyMaterialRowsBatch,
  readMaterialyTransferIds,
  removeMaterialRow,
} from '@/lib/google/sheets'
import { getRelationName } from '@/lib/get-relation-name'
import { protectedAction } from './utils'

type AppRowT = {
  transferId: number
  date: string
  typ: string
  description: string
  amount: number
  category: string
  note: string
}

export type MaterialSyncPreviewT = {
  toAppend: AppRowT[]
  spreadsheetId: string
}

export type ApplyMaterialSyncResultT = {
  added: number
  updated: number
  removed: number
  errors: Array<{ transferId: number; message: string }>
}

// ── relation/value helpers (payload relations are number | object | null) ──────
const relId = (rel: unknown): number | undefined =>
  typeof rel === 'number'
    ? rel
    : typeof rel === 'object' && rel !== null
      ? (rel as { id?: number }).id
      : undefined

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

type TxDoc = {
  id: number
  amount: number | string
  date?: string | null
  description?: string | null
  invoiceNote?: string | null
  expenseCategory?: unknown
  otherCategory?: unknown
}

// + row for an investment expense (skip if it has no expense category → no typ).
function expenseRow(t: TxDoc): AppRowT | undefined {
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

// Every row the sheet should hold: each NON-CANCELLED investment expense, one row
// keyed by its own id. The sheet mirrors active costs — cancelled expenses are
// excluded here (and their rows removed by the reconciler / on cancel).
async function loadAppMaterialRows(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<AppRowT[]> {
  const expenses = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { investment: { equals: investmentId } },
        { type: { equals: 'INVESTMENT_EXPENSE' } },
        { cancelled: { not_equals: true } },
      ],
    },
    depth: 1,
    limit: 0, // all expenses — a capped find would drop rows 1001+ from the desired set,
    overrideAccess: true, // and the reconciler would then delete their (un-enumerated) sheet rows.
  })

  const rows: AppRowT[] = []
  for (const t of expenses.docs as unknown as TxDoc[]) {
    const row = expenseRow(t)
    if (row) rows.push(row)
  }
  return rows
}

// Resolve an investment's linked Google Sheet id, or undefined if it has none.
async function getInvestmentSheetId(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<string | undefined> {
  const investment = await payload.findByID({
    collection: 'investments',
    id: investmentId,
    overrideAccess: true,
  })
  return investment?.googleSheetId ?? undefined
}

export async function previewMaterialSync(investmentId: number) {
  return protectedAction<MaterialSyncPreviewT>('previewMaterialSync', async ({ payload }) => {
    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      return { success: false, error: 'Inwestycja nie ma powiązanego arkusza Google.' }
    }

    const [appRows, sheetIds] = await Promise.all([
      loadAppMaterialRows(payload, investmentId),
      readMaterialyTransferIds(sheetId),
    ])

    // The preview surfaces only rows to APPEND (ids the sheet is missing).
    // applyMaterialSync additionally overwrites present rows and removes this
    // investment's orphaned rows — the preview under-reports those (review T3.1).
    const toAppend = appRows.filter((r) => !sheetIds.has(r.transferId))

    return {
      success: true,
      data: { toAppend, spreadsheetId: sheetId },
    }
  })
}

// Re-derives what to append SERVER-SIDE — never trusts a client-supplied row set.
// The preview the browser holds is display-only; an attacker round-tripping a
// forged toAppend (arbitrary typ/amount/description) would otherwise land in the
// sheet verbatim. The set written here is exactly previewMaterialSync would show.
export async function applyMaterialSync(investmentId: number) {
  return protectedAction<ApplyMaterialSyncResultT>(
    'applyMaterialSync',
    async ({ payload }) => {
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) {
        return { success: false, error: 'Inwestycja nie ma powiązanego arkusza Google.' }
      }

      const [appRows, current] = await Promise.all([
        loadAppMaterialRows(payload, investmentId),
        readMaterialyTransferIds(sheetId),
      ])

      // Scoped orphan-removal: an id on the sheet but not among the active expenses
      // is removable ONLY if it's one of THIS investment's own expenses (a
      // now-cancelled one whose row should go). The guard query is scoped to
      // investment + INVESTMENT_EXPENSE — NOT "is this id any transaction" — because
      // ids are dense sequential PKs: an owner's manual number in the id column (a
      // quantity, a year) would otherwise collide with some unrelated transaction (a
      // payout, another investment's expense) and get its row deleted (review T1.1).
      const appIds = new Set(appRows.map((r) => r.transferId))
      const orphanIds = [...current.keys()].filter((id) => !appIds.has(id))
      let removableIds: number[] = []
      if (orphanIds.length > 0) {
        const removableExpenses = await payload.find({
          collection: 'transactions',
          where: {
            and: [
              { id: { in: orphanIds } },
              { investment: { equals: investmentId } },
              { type: { equals: 'INVESTMENT_EXPENSE' } },
            ],
          },
          depth: 0,
          limit: 0, // enumerate all matches — a truncated page would leave real expense
          overrideAccess: true, // ids unconfirmed, and they'd be wrongly kept as "manual rows".
        })
        removableIds = removableExpenses.docs.map((d) => d.id as number)
      }

      // One batched write: upsert every active expense (append the missing, heal the
      // present) and drop the removable orphans — O(1) Google API calls, not O(N)
      // (review T4.1). The whole batch succeeds or throws (caught by protectedAction),
      // so there is no per-row partial-error set anymore.
      const { added, updated, removed } = await applyMaterialRowsBatch(
        sheetId,
        appRows,
        removableIds,
      )

      return { success: true, data: { added, updated, removed, errors: [] } }
    },
    // The sheet rows are derived from the investment's expenses; the kosztorys/
    // investment UI reads through the investments cache, so invalidate that.
    ['investments'],
  )
}

/**
 * Remove a transfer's row from a SPECIFIC investment's sheet. Called when an edit
 * reassigns an expense to a different investment — the stale row is dropped from the
 * OLD sheet (the new sheet gets the row via syncSingleTransferToSheet). Never throws.
 */
export async function removeTransferFromSheet(params: {
  transferId: number
  investmentId: number
}): Promise<void> {
  try {
    const payload = await getPayload({ config })
    const sheetId = await getInvestmentSheetId(payload, params.investmentId)
    if (!sheetId) return
    await removeMaterialRow(sheetId, params.transferId)
    console.log(`[sheets-sync] remove transfer #${params.transferId} from sheet ${sheetId}`)
  } catch (err) {
    console.error('[sheets-sync] removeTransferFromSheet failed (non-fatal):', err)
  }
}

/**
 * Single-transfer sync from create/cancel/update actions. An INVESTMENT_EXPENSE
 * appends or updates its row; a CANCELLATION removes the original expense's row.
 * Never throws; logs and swallows errors so the calling action's UX is unaffected.
 */
export async function syncSingleTransferToSheet(params: { transferId: number }): Promise<void> {
  try {
    const payload = await getPayload({ config })

    const transfer = await payload.findByID({
      collection: 'transactions',
      id: params.transferId,
      depth: 1,
      overrideAccess: true,
    })
    if (!transfer) return

    // A cancellation no longer adds a reversing row — the sheet mirrors ACTIVE
    // expenses, so cancelling an expense removes its row from the sheet.
    if (transfer.type === 'CANCELLATION') {
      const origId = relId((transfer as { cancelledTransaction?: unknown }).cancelledTransaction)
      if (origId === undefined) return
      const original = await payload.findByID({
        collection: 'transactions',
        id: origId,
        depth: 1,
        overrideAccess: true,
      })
      if (!original || original.type !== 'INVESTMENT_EXPENSE') return
      const investmentId = relId(original.investment)
      if (investmentId === undefined) return
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) return
      await removeMaterialRow(sheetId, origId)
      console.log(`[sheets-sync] cancel #${origId}: removed row from sheet ${sheetId}`)
      return
    }

    if (transfer.type !== 'INVESTMENT_EXPENSE') return
    const investmentId = relId(transfer.investment)
    const row = expenseRow(transfer as unknown as TxDoc)
    if (!row || investmentId === undefined) return

    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no googleSheetId`,
      )
      return
    }

    // One read + one write via the batched path: appends the row if the sheet
    // lacks it, otherwise overwrites the existing row in place.
    const { added } = await applyMaterialRowsBatch(sheetId, [row], [])
    console.log(
      `[sheets-sync] ${added ? 'append' : 'update'} transfer #${params.transferId} → sheet ${sheetId} (${row.typ})`,
    )
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}
