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
import { logError } from '@/lib/utils/log-error'
import { investmentAction } from '@/lib/actions/investment-action'
import { protectedAction } from './run-action'

export type TabSyncPreviewT = {
  label: string
  toAppend: TabRowInputT[]
  toUpdateCount: number
  toRemoveCount: number
}

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

const relId = (rel: unknown): number | undefined =>
  typeof rel === 'number'
    ? rel
    : typeof rel === 'object' && rel !== null
      ? (rel as { id?: number }).id
      : undefined

type PayloadT = Awaited<ReturnType<typeof getPayload>>

type TabSyncSpecT = {
  cfg: SheetTabConfigT
  typeWhere: { equals: string } | { in: string[] }
  // Deliberately NOT applied to the
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

const SETTLED_SYNC: TabSyncSpecT = {
  cfg: SETTLED_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  extraWhere: { settled: { equals: true } },
  buildRow: settledExpenseRow,
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

// Routing
// by type alone (not by the doc's settled flag) is what lets the cleanup paths drop a
// row from every tab it could be on without knowing its current state.
const tabsForType = (type: unknown): TabSyncSpecT[] =>
  isExpensesTabType(type)
    ? [EXPENSES_SYNC, SETTLED_SYNC]
    : isSheetTransferTabType(type)
      ? [TRANSFERS_SYNC]
      : []

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
      // The expenses tab has no auto-create, so a missing one surfaces here
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

// Removal is scoped to THIS
// investment's own transactions of the tab's types
// because ids are dense sequential PKs: an owner's manual number
// in the id column (a quantity, a year) would otherwise collide with some
// unrelated transaction and get its row
// deleted.
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
export async function applyMaterialSync(investmentId: number) {
  return investmentAction<ApplyMaterialSyncResultT>(
    'applyMaterialSync',
    { investmentId },
    async ({ payload }) => {
      const sheetId = await getInvestmentSheetId(payload, investmentId)
      if (!sheetId) {
        return { success: false, error: 'Inwestycja nie ma kosztorysu.' }
      }

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
    ['investments'],
  )
}

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
    for (const tab of tabs) await removeTabRow(sheetId, tab.cfg, params.transferId)
    console.log(`[sheets-sync] remove transfer #${params.transferId} from sheet ${sheetId}`)
  } catch (err) {
    logError('[sheets-sync] removeTransferFromSheet failed (non-fatal):', err)
  }
}

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
      await tab.ensure?.(sheetId)
      const { added } = await applyTabRowsBatch(sheetId, tab.cfg, [row], [])
      console.log(
        `[sheets-sync] ${added ? 'append' : 'update'} transfer #${params.transferId} → ${tab.cfg.tabName} on sheet ${sheetId} (${row.typ})`,
      )
    }
  } catch (err) {
    logError('[sheets-sync] failed (non-fatal):', err)
  }
}

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

    const rowsByInvestment = new Map<number, Map<TabSyncSpecT, TabRowInputT[]>>()
    for (const doc of found.docs) {
      const t = doc as { type?: string; investment?: unknown }
      const investmentId = relId(t.investment)
      if (investmentId === undefined) continue
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
    logError('[sheets-sync] syncBulkExpensesToSheet failed (non-fatal):', err)
  }
}
