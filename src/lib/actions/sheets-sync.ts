'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { appendMaterialRow, readMaterialyTransferIds } from '@/lib/google/sheets'
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
  skipped: number
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

// A cancellation transfer stores its description as `Anulowanie transakcji #<id>\n<reason>`.
// Pull out just the reason (everything after the first newline) for the note column.
const cancellationReason = (description: unknown): string => {
  if (typeof description !== 'string') return ''
  const nl = description.indexOf('\n')
  return nl === -1 ? '' : description.slice(nl + 1).trim()
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
  return {
    transferId: t.id,
    date: isoDate(t.date),
    typ,
    description: t.description ?? '',
    amount: Number(t.amount),
    category: relName(t.otherCategory),
    note: t.invoiceNote ?? '',
  }
}

// − reversing row for a cancellation, built from the original expense it reverses.
// The cancellation's reason goes into the note column so the sheet shows *why* the
// expense was reversed.
function cancellationRow(
  cancellationId: number,
  date: unknown,
  original: TxDoc,
  reason: string,
): AppRowT | undefined {
  const typ = relName(original.expenseCategory)
  if (!typ) return undefined
  return {
    transferId: cancellationId,
    date: isoDate(date),
    typ,
    description: `Anulowanie #${original.id}`,
    amount: -Number(original.amount),
    category: relName(original.otherCategory),
    note: reason,
  }
}

// Every row the sheet should hold: each investment expense (+, even if cancelled)
// and each cancellation that reverses one of them (−). Append-only: nothing is
// ever removed, so a cancelled expense keeps its + row and gains a − row.
async function loadAppMaterialRows(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<AppRowT[]> {
  const expenses = await payload.find({
    collection: 'transactions',
    where: {
      and: [{ investment: { equals: investmentId } }, { type: { equals: 'INVESTMENT_EXPENSE' } }],
    },
    depth: 1,
    limit: 1000,
    overrideAccess: true,
  })

  const rows: AppRowT[] = []
  const expenseById = new Map<number, TxDoc>()
  for (const t of expenses.docs as unknown as TxDoc[]) {
    expenseById.set(t.id, t)
    const row = expenseRow(t)
    if (row) rows.push(row)
  }

  const expenseIds = [...expenseById.keys()]
  if (expenseIds.length > 0) {
    const cancellations = await payload.find({
      collection: 'transactions',
      where: {
        and: [{ type: { equals: 'CANCELLATION' } }, { cancelledTransaction: { in: expenseIds } }],
      },
      depth: 0,
      limit: 1000,
      overrideAccess: true,
    })
    for (const c of cancellations.docs) {
      const origId = relId((c as { cancelledTransaction?: unknown }).cancelledTransaction)
      const original = origId !== undefined ? expenseById.get(origId) : undefined
      if (!original) continue
      const row = cancellationRow(
        c.id,
        (c as { date?: unknown }).date,
        original,
        cancellationReason((c as { description?: unknown }).description),
      )
      if (row) rows.push(row)
    }
  }
  return rows
}

export async function previewMaterialSync(investmentId: number) {
  return protectedAction<MaterialSyncPreviewT>('previewMaterialSync', async ({ payload }) => {
    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
    })
    if (!investment?.googleSheetId) {
      return { success: false, error: 'Inwestycja nie ma powiązanego arkusza Google.' }
    }
    const sheetId = investment.googleSheetId

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
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment?.googleSheetId) {
        return { success: false, error: 'Inwestycja nie ma powiązanego arkusza Google.' }
      }
      const sheetId = investment.googleSheetId

      const [appRows, current] = await Promise.all([
        loadAppMaterialRows(payload, investmentId),
        readMaterialyTransferIds(sheetId),
      ])
      const toAppend = appRows.filter((r) => !current.has(r.transferId))

      let added = 0
      let skipped = 0
      const errors: ApplyMaterialSyncResultT['errors'] = []

      for (const row of toAppend) {
        if (current.has(row.transferId)) {
          skipped++
          continue
        }
        try {
          await appendMaterialRow(sheetId, row)
          added++
        } catch (err) {
          errors.push({ transferId: row.transferId, message: String(err) })
        }
      }

      return { success: true, data: { added, skipped, errors } }
    },
    ['transfers'],
  )
}

/**
 * Single-transfer sync, called fire-and-forget from create/cancel server actions.
 * Append-only: an INVESTMENT_EXPENSE appends a + row; a CANCELLATION appends a −
 * reversing row (same typ as the original, its own id). Never throws; logs and
 * swallows errors so the calling action's UX is unaffected.
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

    let row: AppRowT | undefined
    let investmentId: number | undefined

    if (transfer.type === 'INVESTMENT_EXPENSE') {
      investmentId = relId(transfer.investment)
      row = expenseRow(transfer as unknown as TxDoc)
    } else if (transfer.type === 'CANCELLATION') {
      const origId = relId((transfer as { cancelledTransaction?: unknown }).cancelledTransaction)
      if (origId === undefined) return
      const original = await payload.findByID({
        collection: 'transactions',
        id: origId,
        depth: 1,
        overrideAccess: true,
      })
      if (!original || original.type !== 'INVESTMENT_EXPENSE') return
      investmentId = relId(original.investment)
      row = cancellationRow(
        transfer.id,
        transfer.date,
        original as unknown as TxDoc,
        cancellationReason(transfer.description),
      )
    } else {
      return
    }

    if (!row || investmentId === undefined) return

    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
    })
    const sheetId = investment?.googleSheetId
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no googleSheetId`,
      )
      return
    }

    const existing = await readMaterialyTransferIds(sheetId)
    if (existing.has(params.transferId)) return

    await appendMaterialRow(sheetId, row)
    console.log(
      `[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${row.typ}${
        row.amount < 0 ? ', reversal' : ''
      })`,
    )
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}
