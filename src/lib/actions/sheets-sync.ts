'use server'

import type { getPayload } from 'payload'
import { applyTabRowsBatch, readTabTransferIds, type TabRowInputT } from '@/lib/google/sheets'
import {
  EXPENSES_SYNC,
  SETTLED_SYNC,
  TRANSFERS_SYNC,
  type TabSyncSpecT,
} from '@/lib/google/transfer-sheet-sync'
import type { TxDocT } from '@/lib/google/tab-rows'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
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

type PayloadT = Awaited<ReturnType<typeof getPayload>>

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
