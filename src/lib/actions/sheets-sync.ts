'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  applyTabRowsBatch,
  EXPENSES_TAB_CONFIG,
  readTabTransferIds,
  removeTabRow,
  type TabRowInputT,
} from '@/lib/google/sheets'
import { expenseRow, type TxDocT } from '@/lib/google/tab-rows'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { protectedAction } from './utils'

export type MaterialSyncPreviewT = {
  toAppend: TabRowInputT[]
  // What a confirm would ALSO do beyond appends: refresh present rows in place and
  // remove this investment's orphaned rows. Surfaced so the dialog doesn't claim
  // "nothing to do" when there are still updates/removes pending (review T3.1).
  toUpdateCount: number
  toRemoveCount: number
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

// Every row the sheet should hold: each NON-CANCELLED investment expense, one row
// keyed by its own id. The sheet mirrors active costs — cancelled expenses are
// excluded here (and their rows removed by the reconciler / on cancel).
async function loadAppMaterialRows(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<TabRowInputT[]> {
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

  const rows: TabRowInputT[] = []
  for (const t of expenses.docs as unknown as TxDocT[]) {
    const row = expenseRow(t)
    if (row) rows.push(row)
  }
  return rows
}

export async function previewMaterialSync(investmentId: number) {
  return protectedAction<MaterialSyncPreviewT>('previewMaterialSync', async ({ payload }) => {
    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      return { success: false, error: 'Inwestycja nie ma kosztorysu.' }
    }

    const { appRows, toAppend, removableIds } = await buildSyncPlan(payload, investmentId, sheetId)

    return {
      success: true,
      data: {
        toAppend,
        toUpdateCount: appRows.length - toAppend.length,
        toRemoveCount: removableIds.length,
        spreadsheetId: sheetId,
      },
    }
  })
}

// The shared sync plan, used by BOTH preview and apply so they can never disagree:
// which active expenses to append (missing from the sheet) vs refresh (present),
// and which sheet rows to remove. Removal is scoped to THIS investment's own
// expenses — NOT "is this id any transaction" — because ids are dense sequential
// PKs: an owner's manual number in the id column (a quantity, a year) would
// otherwise collide with some unrelated transaction (a payout, another
// investment's expense) and get its row deleted (review T1.1).
async function buildSyncPlan(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
  sheetId: string,
): Promise<{ appRows: TabRowInputT[]; toAppend: TabRowInputT[]; removableIds: number[] }> {
  const [appRows, current] = await Promise.all([
    loadAppMaterialRows(payload, investmentId),
    readTabTransferIds(sheetId, EXPENSES_TAB_CONFIG),
  ])

  const toAppend = appRows.filter((r) => !current.has(r.transferId))

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

  return { appRows, toAppend, removableIds }
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
        return { success: false, error: 'Inwestycja nie ma kosztorysu.' }
      }

      const { appRows, removableIds } = await buildSyncPlan(payload, investmentId, sheetId)

      // One batched write: upsert every active expense (append the missing, heal the
      // present) and drop the removable orphans — O(1) Google API calls, not O(N)
      // (review T4.1). The whole batch succeeds or throws (caught by protectedAction),
      // so there is no per-row partial-error set anymore.
      const { added, updated, removed } = await applyTabRowsBatch(
        sheetId,
        EXPENSES_TAB_CONFIG,
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
    await removeTabRow(sheetId, EXPENSES_TAB_CONFIG, params.transferId)
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
      await removeTabRow(sheetId, EXPENSES_TAB_CONFIG, origId)
      console.log(`[sheets-sync] cancel #${origId}: removed row from sheet ${sheetId}`)
      return
    }

    if (transfer.type !== 'INVESTMENT_EXPENSE') return
    const investmentId = relId(transfer.investment)
    if (investmentId === undefined) return

    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no linked kosztorys`,
      )
      return
    }

    // A cancelled expense (the sheet mirrors ACTIVE costs — this is how cancellation
    // removal works when driven from the collection hook), or one no longer mappable
    // (category cleared → empty typ, or a non-finite amount), should NOT be on the
    // sheet — drop any row it has (review T2.4). removeMaterialRow no-ops if absent.
    const row = (transfer as { cancelled?: boolean }).cancelled
      ? undefined
      : expenseRow(transfer as unknown as TxDocT)
    if (!row) {
      await removeTabRow(sheetId, EXPENSES_TAB_CONFIG, params.transferId)
      console.log(
        `[sheets-sync] transfer #${params.transferId} cancelled/unmappable → removed from sheet ${sheetId}`,
      )
      return
    }

    // One read + one write via the batched path: appends the row if the sheet
    // lacks it, otherwise overwrites the existing row in place.
    const { added } = await applyTabRowsBatch(sheetId, EXPENSES_TAB_CONFIG, [row], [])
    console.log(
      `[sheets-sync] ${added ? 'append' : 'update'} transfer #${params.transferId} → sheet ${sheetId} (${row.typ})`,
    )
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}

/**
 * Batched sync for a set of just-created transfers (the bulk-create path). Groups
 * the mappable INVESTMENT_EXPENSE rows by investment and writes each investment's
 * sheet in ONE batched call — instead of N serialized single-transfer syncs, each
 * re-reading the sheet (review T4.2). Never throws; logs and swallows errors.
 */
export async function syncBulkExpensesToSheet(transferIds: number[]): Promise<void> {
  try {
    if (transferIds.length === 0) return
    const payload = await getPayload({ config })
    const found = await payload.find({
      collection: 'transactions',
      where: { id: { in: transferIds } },
      depth: 1,
      limit: 0,
      overrideAccess: true,
    })

    // Group expense rows by investment (a bulk is normally one investment, but the
    // grouping keeps it correct if that ever changes).
    const rowsByInvestment = new Map<number, TabRowInputT[]>()
    for (const doc of found.docs) {
      const t = doc as { type?: string; investment?: unknown }
      if (t.type !== 'INVESTMENT_EXPENSE') continue
      const investmentId = relId(t.investment)
      const row = expenseRow(doc as unknown as TxDocT)
      if (investmentId === undefined || !row) continue
      const list = rowsByInvestment.get(investmentId) ?? []
      list.push(row)
      rowsByInvestment.set(investmentId, list)
    }

    for (const [investmentId, rows] of rowsByInvestment) {
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) continue
      const { added, updated } = await applyTabRowsBatch(sheetId, EXPENSES_TAB_CONFIG, rows, [])
      console.log(
        `[sheets-sync] bulk sync investment #${investmentId} → +${added}/${updated} on sheet ${sheetId}`,
      )
    }
  } catch (err) {
    console.error('[sheets-sync] syncBulkExpensesToSheet failed (non-fatal):', err)
  }
}
