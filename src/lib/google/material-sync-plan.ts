import type { getPayload } from 'payload'
import { readTabTransferIds, type TabRowInputT } from '@/lib/google/sheets'
import type { TabSyncSpecT } from '@/lib/google/transfer-sheet-sync'
import type { TxDocT } from '@/lib/google/tab-rows'

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

// Removal is scoped to THIS
// investment's own transactions of the tab's types
// because ids are dense sequential PKs: an owner's manual number
// in the id column (a quantity, a year) would otherwise collide with some
// unrelated transaction and get its row
// deleted.
export async function buildSyncPlan(
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
