'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  appendMaterialRow,
  readMaterialyTransferIds,
  removeMaterialRow,
  updateMaterialRow,
} from '@/lib/google/sheets'
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
const relName = (rel: unknown): string =>
  typeof rel === 'object' && rel !== null ? ((rel as { name?: string }).name ?? '') : ''

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
  const typ = relName(t.expenseCategory)
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
    category: relName(t.otherCategory),
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
    limit: 1000,
    overrideAccess: true,
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

    // Append-only: the reconciler only adds app rows the sheet is missing. Rows
    // the app doesn't recognise are the owner's own data — left untouched, not
    // flagged. Nothing is ever deleted.
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

      let added = 0
      let updated = 0
      let removed = 0
      const errors: ApplyMaterialSyncResultT['errors'] = []

      // Overwrite-by-id heal: append rows the sheet lacks, overwrite present ones to
      // match the DB. The id is the join key, not a content fingerprint — an edit
      // never changes the id — so we overwrite unconditionally rather than compare.
      // Appends go to the bottom and don't shift existing rows, so the row numbers in
      // `current` stay valid for the overwrites.
      for (const row of appRows) {
        const existingRow = current.get(row.transferId)
        try {
          if (existingRow !== undefined) {
            await updateMaterialRow(sheetId, existingRow, row)
            updated++
          } else {
            await appendMaterialRow(sheetId, row)
            added++
          }
        } catch (err) {
          errors.push({ transferId: row.transferId, message: String(err) })
        }
      }

      // Scoped orphan-removal: drop sheet rows whose id is no longer an active expense
      // for this investment BUT only when that id is a real transaction (a cancelled
      // expense, one moved to another investment, or a deleted row). Sheet ids that
      // aren't real transactions are the owner's own manual rows — leave them alone.
      const appIds = new Set(appRows.map((r) => r.transferId))
      const orphanIds = [...current.keys()].filter((id) => !appIds.has(id))
      if (orphanIds.length > 0) {
        const realTransactions = await payload.find({
          collection: 'transactions',
          where: { id: { in: orphanIds } },
          depth: 0,
          limit: 1000,
          overrideAccess: true,
        })
        const realTransactionIds = new Set(realTransactions.docs.map((d) => d.id as number))
        for (const id of orphanIds) {
          if (!realTransactionIds.has(id)) continue // owner's manual row — keep
          try {
            await removeMaterialRow(sheetId, id)
            removed++
          } catch (err) {
            errors.push({ transferId: id, message: String(err) })
          }
        }
      }

      return { success: true, data: { added, updated, removed, errors } }
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

    const existing = await readMaterialyTransferIds(sheetId)
    const existingRow = existing.get(params.transferId)
    if (existingRow !== undefined) {
      await updateMaterialRow(sheetId, existingRow, row)
      console.log(
        `[sheets-sync] update transfer #${params.transferId} → sheet ${sheetId} row ${existingRow}`,
      )
      return
    }

    await appendMaterialRow(sheetId, row)
    console.log(
      `[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${row.typ})`,
    )
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}
