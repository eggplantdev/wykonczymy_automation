'use server'

import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import {
  applyTabRowsBatch,
  ensureTab,
  EXPENSES_TAB_CONFIG,
  readTabTransferIds,
  removeTabRow,
  SETTLED_TAB_CONFIG,
  TRANSFERS_TAB_CONFIG,
  transferSummaryKeys,
  type SheetTabConfigT,
  type TabRowInputT,
} from '@/lib/google/sheets'
import { getExpenseTypeNames } from '@/lib/google/expense-categories'
import { expenseRow, settledExpenseRow, transferRow, type TxDocT } from '@/lib/google/tab-rows'
import {
  isSheetTransferTabType,
  isExpensesTabType,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
} from '@/lib/constants/transfers'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { protectedAction } from './run-action'

// One tab's pending changes. `toUpdateCount`/`toRemoveCount` are what a confirm would
// do BEYOND appends (refresh present rows, remove this investment's orphans) — surfaced
// so the dialog doesn't claim "nothing to do" when updates/removes are pending (T3.1).
export type TabSyncPreviewT = {
  label: string
  toAppend: TabRowInputT[]
  toUpdateCount: number
  toRemoveCount: number
}

// The confirm reconciles every app-managed tab, so each contributes its own pending
// counts and the confirm stays enabled when any single tab has a delta.
export type MaterialSyncPreviewT = {
  tabs: TabSyncPreviewT[]
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
  // Extra desired-row filter ANDed onto type/investment/cancelled in loadAppRows —
  // e.g. the rozliczone tab only wants settled rows. Deliberately NOT applied to the
  // orphan-removal query: a row that stops matching (settled→normal) must still be
  // recognised as a removable orphan, not silently kept.
  extraWhere?: Where
  buildRow: (t: TxDocT) => TabRowInputT | undefined
  ensure?: (sheetId: string) => Promise<{ created: boolean }>
}

const EXPENSES_SYNC: TabSyncSpecT = {
  cfg: EXPENSES_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  buildRow: expenseRow,
}

// The rozliczone R+M tab: only settled expenses, at their real amount. Auto-creates
// itself (with the current category summary) on already-linked sheets that predate it.
const SETTLED_SYNC: TabSyncSpecT = {
  cfg: SETTLED_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  extraWhere: { settled: { equals: true } },
  buildRow: settledExpenseRow,
  // Lazy keys: the category lookup runs only when ensureTab actually has to build the
  // tab — not on every settled-expense save once it already exists.
  ensure: (sheetId) =>
    ensureTab(sheetId, SETTLED_TAB_CONFIG, async () =>
      getExpenseTypeNames(await getPayload({ config })),
    ),
}

const TRANSFERS_SYNC: TabSyncSpecT = {
  cfg: TRANSFERS_TAB_CONFIG,
  typeWhere: { in: [...SHEET_TRANSFER_TAB_TYPES] },
  buildRow: transferRow,
  ensure: (sheetId) => ensureTab(sheetId, TRANSFERS_TAB_CONFIG, transferSummaryKeys()),
}

// The tabs a transaction of this type can occupy. An expenses-type lands on BOTH the
// bill tab and the rozliczone tab — each tab's buildRow then decides whether the
// specific doc belongs (settledExpenseRow returns undefined for a non-settled row, so
// iterating the list upserts where it belongs and removes where it doesn't). Routing
// by type alone (not by the doc's settled flag) is what lets the cleanup paths drop a
// row from every tab it could be on without knowing its current state.
const tabsForType = (type: unknown): TabSyncSpecT[] =>
  isExpensesTabType(type)
    ? [EXPENSES_SYNC, SETTLED_SYNC]
    : isSheetTransferTabType(type)
      ? [TRANSFERS_SYNC]
      : []

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
        ...(tab.extraWhere ? [tab.extraWhere] : []),
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

    const previewTabs: Array<{ label: string; spec: TabSyncSpecT }> = [
      { label: 'Wydatki', spec: EXPENSES_SYNC },
      { label: 'Transfery', spec: TRANSFERS_SYNC },
      { label: 'Rozliczone R+M', spec: SETTLED_SYNC },
    ]

    const tabs: TabSyncPreviewT[] = []
    for (const { label, spec } of previewTabs) {
      // Tabs that self-heal (have an `ensure`) may not exist yet on older sheets —
      // preview treats a missing one as "everything appends"; the apply path creates
      // it. The expenses tab has no auto-create, so a missing one surfaces here
      // (throws → the reset-button hint) rather than being silently treated as empty.
      const plan = await buildSyncPlan(payload, investmentId, sheetId, spec, {
        emptyIfMissing: !!spec.ensure,
      })
      tabs.push({
        label,
        toAppend: plan.toAppend,
        toUpdateCount: plan.appRows.length - plan.toAppend.length,
        toRemoveCount: plan.removableIds.length,
      })
    }

    return { success: true, data: { tabs, spreadsheetId: sheetId } }
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

      // Reconcile every app-managed tab — concurrently, since each writes a DISJOINT
      // tab of the same spreadsheet and shares no state. Per tab: self-heal a missing
      // tab (the transfers/rozliczone tabs may predate the sheet; the expenses tab has
      // no ensure by design), then one batched write — upsert every active row (append
      // the missing, heal the present) and drop the removable orphans, O(1) Google API
      // calls per tab not O(N) (review T4.1). Orphan removal on the rozliczone tab drops
      // rows whose transaction is no longer settled/active (toggle, cancel, delete). If
      // any tab throws, Promise.all rejects and protectedAction surfaces the error.
      const results = await Promise.all(
        [EXPENSES_SYNC, TRANSFERS_SYNC, SETTLED_SYNC].map(async (spec) => {
          await spec.ensure?.(sheetId)
          const plan = await buildSyncPlan(payload, investmentId, sheetId, spec)
          return applyTabRowsBatch(sheetId, spec.cfg, plan.appRows, plan.removableIds)
        }),
      )

      return {
        success: true,
        data: {
          added: results.reduce((s, r) => s + r.added, 0),
          updated: results.reduce((s, r) => s + r.updated, 0),
          removed: results.reduce((s, r) => s + r.removed, 0),
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
    const tabs = tabsForType(params.type)
    if (tabs.length === 0) return
    const payload = await getPayload({ config })
    const sheetId = await getInvestmentSheetId(payload, params.investmentId)
    if (!sheetId) return
    // Drop the row from EVERY tab the type can occupy — a settled expense is on both
    // the bill and rozliczone tabs; removeTabRow no-ops where it isn't present.
    for (const tab of tabs) await removeTabRow(sheetId, tab.cfg, params.transferId)
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
      const origTabs = tabsForType(original?.type)
      if (!original || origTabs.length === 0) return
      const investmentId = relId(original.investment)
      if (investmentId === undefined) return
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) return
      for (const tab of origTabs) await removeTabRow(sheetId, tab.cfg, origId)
      console.log(`[sheets-sync] cancel #${origId}: removed row from sheet ${sheetId}`)
      return
    }

    const tabs = tabsForType(transfer.type)
    if (tabs.length === 0) return
    const investmentId = relId(transfer.investment)
    if (investmentId === undefined) return

    const sheetId = await getInvestmentSheetId(payload, investmentId)
    if (!sheetId) {
      console.log(
        `[sheets-sync] skip transfer #${params.transferId}: investment #${investmentId} has no linked kosztorys`,
      )
      return
    }

    // Resolve the row PER TAB: a cancelled transfer (the sheet mirrors ACTIVE rows),
    // or one not belonging on a given tab (non-settled → no rozliczone row;
    // category cleared → empty typ; non-finite amount), yields no row for that tab and
    // is removed from it (review T2.4) — so a settled→normal toggle drops the stale
    // rozliczone row while the bill row is refreshed in the same pass. removeTabRow
    // no-ops if absent.
    const cancelled = (transfer as { cancelled?: boolean }).cancelled
    for (const tab of tabs) {
      const row = cancelled ? undefined : tab.buildRow(transfer as unknown as TxDocT)
      if (!row) {
        await removeTabRow(sheetId, tab.cfg, params.transferId)
        console.log(
          `[sheets-sync] transfer #${params.transferId} not on ${tab.cfg.tabName} → removed from sheet ${sheetId}`,
        )
        continue
      }
      // Sheets linked before a tab existed self-heal on first write.
      await tab.ensure?.(sheetId)
      // One read + one write via the batched path: append if missing, else overwrite.
      const { added } = await applyTabRowsBatch(sheetId, tab.cfg, [row], [])
      console.log(
        `[sheets-sync] ${added ? 'append' : 'update'} transfer #${params.transferId} → ${tab.cfg.tabName} on sheet ${sheetId} (${row.typ})`,
      )
    }
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
      const investmentId = relId(t.investment)
      if (investmentId === undefined) continue
      // A settled expense fans out to both the bill and rozliczone tabs; each tab's
      // buildRow decides whether this doc yields a row there.
      for (const tab of tabsForType(t.type)) {
        const row = tab.buildRow(doc as unknown as TxDocT)
        if (!row) continue
        const byTab = rowsByInvestment.get(investmentId) ?? new Map<TabSyncSpecT, TabRowInputT[]>()
        const list = byTab.get(tab) ?? []
        list.push(row)
        byTab.set(tab, list)
        rowsByInvestment.set(investmentId, byTab)
      }
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
