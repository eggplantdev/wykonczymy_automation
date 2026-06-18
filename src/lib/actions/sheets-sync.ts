'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  applyTabRowsBatch,
  ensureTab,
  EXPENSES_TAB_CONFIG,
  readTabTransferIds,
  removeTabRow,
  TRANSFERS_TAB_CONFIG,
  transferSummaryKeys,
  type SheetTabConfigT,
  type TabRowInputT,
} from '@/lib/google/sheets'
import { expenseRow, transferRow, type TxDocT } from '@/lib/google/tab-rows'
import {
  isSheetTransferTabType,
  isExpensesTabType,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
} from '@/lib/constants/transfers'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { protectedAction } from './utils'

export type MaterialSyncPreviewT = {
  toAppend: TabRowInputT[]
  // What a confirm would ALSO do beyond appends: refresh present rows in place and
  // remove this investment's orphaned rows. Surfaced so the dialog doesn't claim
  // "nothing to do" when there are still updates/removes pending (review T3.1).
  toUpdateCount: number
  toRemoveCount: number
  // Same three figures for the transfers tab — the confirm reconciles BOTH tabs,
  // so a transfers-only pending change must keep the confirm button enabled.
  transfersToAppend: TabRowInputT[]
  transfersToUpdateCount: number
  transfersToRemoveCount: number
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

type PayloadT = Awaited<ReturnType<typeof getPayload>>

// Everything tab-specific the sync plan needs: which tab to read/write, which
// transaction types may own a row there (drives the desired-row query AND the
// orphan-removal guard), how a transaction doc becomes a row, and — when set —
// how to self-heal a missing tab before writing (sheets linked before the
// transfers tab existed don't have it; the expenses tab deliberately has no
// auto-create, its missing-tab error carries the reset-button hint instead).
type TabSyncSpecT = {
  cfg: SheetTabConfigT
  typeWhere: { equals: string } | { in: string[] }
  buildRow: (t: TxDocT) => TabRowInputT | undefined
  ensure?: (sheetId: string) => Promise<{ created: boolean }>
}

const EXPENSES_SYNC: TabSyncSpecT = {
  cfg: EXPENSES_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  buildRow: expenseRow,
}

const TRANSFERS_SYNC: TabSyncSpecT = {
  cfg: TRANSFERS_TAB_CONFIG,
  typeWhere: { in: [...SHEET_TRANSFER_TAB_TYPES] },
  buildRow: transferRow,
  ensure: (sheetId) => ensureTab(sheetId, TRANSFERS_TAB_CONFIG, transferSummaryKeys()),
}

// Which tab (if any) mirrors a transaction of this type.
const tabSyncForType = (type: unknown): TabSyncSpecT | undefined =>
  isExpensesTabType(type)
    ? EXPENSES_SYNC
    : isSheetTransferTabType(type)
      ? TRANSFERS_SYNC
      : undefined

// Every row the tab should hold: each NON-CANCELLED transaction of the tab's
// types, one row keyed by its own id. The sheet mirrors active transfers —
// cancelled ones are excluded here (and their rows removed by the reconciler /
// on cancel). An investment-less transfer (LOSS allows that) never matches the
// investment filter, so it appears on no sheet.
async function loadAppRows(
  payload: PayloadT,
  investmentId: number,
  tab: TabSyncSpecT,
): Promise<TabRowInputT[]> {
  const found = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { investment: { equals: investmentId } },
        { type: tab.typeWhere },
        { cancelled: { not_equals: true } },
      ],
    },
    depth: 1,
    limit: 0, // all rows — a capped find would drop rows 1001+ from the desired set,
    overrideAccess: true, // and the reconciler would then delete their (un-enumerated) sheet rows.
  })

  const rows: TabRowInputT[] = []
  for (const t of found.docs as unknown as TxDocT[]) {
    const row = tab.buildRow(t)
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

    const expenses = await buildSyncPlan(payload, investmentId, sheetId, EXPENSES_SYNC)
    // The transfers tab may not exist yet (sheets linked before the feature) —
    // preview treats that as "everything appends"; the apply path creates the tab.
    const transfers = await buildSyncPlan(payload, investmentId, sheetId, TRANSFERS_SYNC, {
      emptyIfMissing: true,
    })

    return {
      success: true,
      data: {
        toAppend: expenses.toAppend,
        toUpdateCount: expenses.appRows.length - expenses.toAppend.length,
        toRemoveCount: expenses.removableIds.length,
        transfersToAppend: transfers.toAppend,
        transfersToUpdateCount: transfers.appRows.length - transfers.toAppend.length,
        transfersToRemoveCount: transfers.removableIds.length,
        spreadsheetId: sheetId,
      },
    }
  })
}

// The shared per-tab sync plan, used by BOTH preview and apply so they can never
// disagree: which active rows to append (missing from the sheet) vs refresh
// (present), and which sheet rows to remove. Removal is scoped to THIS
// investment's own transactions of the tab's types — NOT "is this id any
// transaction" — because ids are dense sequential PKs: an owner's manual number
// in the id column (a quantity, a year) would otherwise collide with some
// unrelated transaction (a payout, another investment's expense) and get its row
// deleted (review T1.1).
async function buildSyncPlan(
  payload: PayloadT,
  investmentId: number,
  sheetId: string,
  tab: TabSyncSpecT,
  readOpts: { emptyIfMissing?: boolean } = {},
): Promise<{ appRows: TabRowInputT[]; toAppend: TabRowInputT[]; removableIds: number[] }> {
  const [appRows, current] = await Promise.all([
    loadAppRows(payload, investmentId, tab),
    readTabTransferIds(sheetId, tab.cfg, readOpts),
  ])

  const toAppend = appRows.filter((r) => !current.has(r.transferId))

  const appIds = new Set(appRows.map((r) => r.transferId))
  const orphanIds = [...current.keys()].filter((id) => !appIds.has(id))
  let removableIds: number[] = []
  if (orphanIds.length > 0) {
    const removable = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { id: { in: orphanIds } },
          { investment: { equals: investmentId } },
          { type: tab.typeWhere },
        ],
      },
      depth: 0,
      limit: 0, // enumerate all matches — a truncated page would leave real transfer
      overrideAccess: true, // ids unconfirmed, and they'd be wrongly kept as "manual rows".
    })
    removableIds = removable.docs.map((d) => d.id as number)
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

      // One batched write per tab: upsert every active row (append the missing,
      // heal the present) and drop the removable orphans — O(1) Google API calls
      // per tab, not O(N) (review T4.1). The whole batch succeeds or throws
      // (caught by protectedAction), so there is no per-row partial-error set.
      const expensesPlan = await buildSyncPlan(payload, investmentId, sheetId, EXPENSES_SYNC)
      const e = await applyTabRowsBatch(
        sheetId,
        EXPENSES_TAB_CONFIG,
        expensesPlan.appRows,
        expensesPlan.removableIds,
      )

      // Sheets linked before the transfers tab existed self-heal here: create the
      // tab if it's missing, then reconcile it like the expenses tab.
      await TRANSFERS_SYNC.ensure?.(sheetId)
      const transfersPlan = await buildSyncPlan(payload, investmentId, sheetId, TRANSFERS_SYNC)
      const t = await applyTabRowsBatch(
        sheetId,
        TRANSFERS_TAB_CONFIG,
        transfersPlan.appRows,
        transfersPlan.removableIds,
      )

      return {
        success: true,
        data: {
          added: e.added + t.added,
          updated: e.updated + t.updated,
          removed: e.removed + t.removed,
          errors: [],
        },
      }
    },
    // The sheet rows are derived from the investment's expenses; the kosztorys/
    // investment UI reads through the investments cache, so invalidate that.
    ['investments'],
  )
}

/**
 * Remove a transfer's row from a SPECIFIC investment's sheet. Called when an edit
 * reassigns a transfer to a different investment — the stale row is dropped from the
 * OLD sheet (the new sheet gets the row via syncSingleTransferToSheet) — and on
 * delete. `type` picks the tab; a type no tab mirrors is a no-op. Never throws.
 */
export async function removeTransferFromSheet(params: {
  transferId: number
  investmentId: number
  type: string
}): Promise<void> {
  try {
    const tab = tabSyncForType(params.type)
    if (!tab) return
    const payload = await getPayload({ config })
    const sheetId = await getInvestmentSheetId(payload, params.investmentId)
    if (!sheetId) return
    await removeTabRow(sheetId, tab.cfg, params.transferId)
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
    // transfers, so cancelling one removes its row from whichever tab held it.
    if (transfer.type === 'CANCELLATION') {
      const origId = relId((transfer as { cancelledTransaction?: unknown }).cancelledTransaction)
      if (origId === undefined) return
      const original = await payload.findByID({
        collection: 'transactions',
        id: origId,
        depth: 1,
        overrideAccess: true,
      })
      const origTab = tabSyncForType(original?.type)
      if (!original || !origTab) return
      const investmentId = relId(original.investment)
      if (investmentId === undefined) return
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) return
      await removeTabRow(sheetId, origTab.cfg, origId)
      console.log(`[sheets-sync] cancel #${origId}: removed row from sheet ${sheetId}`)
      return
    }

    const tab = tabSyncForType(transfer.type)
    if (!tab) return
    const investmentId = relId(transfer.investment)
    if (investmentId === undefined) return

    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no linked kosztorys`,
      )
      return
    }

    // A cancelled transfer (the sheet mirrors ACTIVE rows — this is how cancellation
    // removal works when driven from the collection hook), or one no longer mappable
    // (category cleared → empty typ, or a non-finite amount), should NOT be on the
    // sheet — drop any row it has (review T2.4). removeTabRow no-ops if absent.
    const row = (transfer as { cancelled?: boolean }).cancelled
      ? undefined
      : tab.buildRow(transfer as unknown as TxDocT)
    if (!row) {
      await removeTabRow(sheetId, tab.cfg, params.transferId)
      console.log(
        `[sheets-sync] transfer #${params.transferId} cancelled/unmappable → removed from sheet ${sheetId}`,
      )
      return
    }

    // Sheets linked before the transfers tab existed self-heal on first write.
    await tab.ensure?.(sheetId)

    // One read + one write via the batched path: appends the row if the sheet
    // lacks it, otherwise overwrites the existing row in place.
    const { added } = await applyTabRowsBatch(sheetId, tab.cfg, [row], [])
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

    // Group rows by investment AND tab (a bulk is normally one investment, but the
    // grouping keeps it correct if that ever changes).
    const rowsByInvestment = new Map<number, Map<TabSyncSpecT, TabRowInputT[]>>()
    for (const doc of found.docs) {
      const t = doc as { type?: string; investment?: unknown }
      const tab = tabSyncForType(t.type)
      if (!tab) continue
      const investmentId = relId(t.investment)
      const row = tab.buildRow(doc as unknown as TxDocT)
      if (investmentId === undefined || !row) continue
      const byTab = rowsByInvestment.get(investmentId) ?? new Map<TabSyncSpecT, TabRowInputT[]>()
      const list = byTab.get(tab) ?? []
      list.push(row)
      byTab.set(tab, list)
      rowsByInvestment.set(investmentId, byTab)
    }

    for (const [investmentId, byTab] of rowsByInvestment) {
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) continue
      for (const [tab, rows] of byTab) {
        await tab.ensure?.(sheetId)
        const { added, updated } = await applyTabRowsBatch(sheetId, tab.cfg, rows, [])
        console.log(
          `[sheets-sync] bulk sync investment #${investmentId} (${tab.cfg.tabName}) → +${added}/${updated} on sheet ${sheetId}`,
        )
      }
    }
  } catch (err) {
    console.error('[sheets-sync] syncBulkExpensesToSheet failed (non-fatal):', err)
  }
}
