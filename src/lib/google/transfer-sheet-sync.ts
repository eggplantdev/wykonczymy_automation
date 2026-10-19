import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import {
  applyTabRowsBatch,
  ensureTab,
  EXPENSES_TAB_CONFIG,
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

const relId = (rel: unknown): number | undefined =>
  typeof rel === 'number'
    ? rel
    : typeof rel === 'object' && rel !== null
      ? (rel as { id?: number }).id
      : undefined

export type TabSyncSpecT = {
  cfg: SheetTabConfigT
  typeWhere: { equals: string } | { in: string[] }
  // Deliberately NOT applied to the
  // orphan-removal query: a row that stops matching (settled→normal) must still be
  // recognised as a removable orphan, not silently kept.
  extraWhere?: Where
  buildRow: (t: TxDocT) => TabRowInputT | undefined
  ensure?: (sheetId: string) => Promise<{ created: boolean }>
}

export const EXPENSES_SYNC: TabSyncSpecT = {
  cfg: EXPENSES_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  buildRow: expenseRow,
}

export const SETTLED_SYNC: TabSyncSpecT = {
  cfg: SETTLED_TAB_CONFIG,
  typeWhere: { in: [...EXPENSES_TAB_TYPES] },
  extraWhere: { settled: { equals: true } },
  buildRow: settledExpenseRow,
  ensure: (sheetId) =>
    ensureTab(sheetId, SETTLED_TAB_CONFIG, async () =>
      getExpenseTypeNames(await getPayload({ config })),
    ),
}

export const TRANSFERS_SYNC: TabSyncSpecT = {
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
