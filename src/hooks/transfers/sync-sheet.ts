import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { after } from 'next/server'

// sheets-sync is a 'use server' module (it pulls in `server-only` + the Payload
// config), so it's imported LAZILY inside after() — a static import here would poison
// the transactions collection's import graph for client/test contexts that load it.

const resolveId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

// Mirror transaction mutations into the kosztorys sheet from the COLLECTION layer,
// so EVERY mutation path is covered — the server actions AND direct Payload admin
// edits/deletes (review T2.2). syncSingleTransferToSheet decides append / update /
// remove from the doc's current state (a cancelled or unmappable expense is removed).
//
// Deferred via after() so the mutation response isn't blocked on the Google API.
// The bulk-create action sets context.skipSheetSync and batches the sync itself
// (review T4.2), so we don't fire N per-row syncs from here.
export const syncSheetAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc, context }) => {
  if (context?.skipSheetSync) return doc
  // Only expense rows touch the sheet. Cancellation is handled here too: cancelling
  // flips the original expense's `cancelled` flag (an INVESTMENT_EXPENSE afterChange),
  // and syncSingleTransferToSheet removes a cancelled expense's row. The separate
  // CANCELLATION audit row is not itself a sheet row, so it's skipped.
  if (doc.type !== 'INVESTMENT_EXPENSE') return doc

  const transferId = doc.id as number
  const prevInvestmentId = resolveId(previousDoc?.investment)
  const investmentId = resolveId(doc.investment)

  after(async () => {
    const { removeTransferFromSheet, syncSingleTransferToSheet } =
      await import('@/lib/actions/sheets-sync')
    // Investment reassigned (read from the persisted docs, so this is correct even
    // when an edit omits the field — closes review T2.3): drop the stale row from the
    // OLD sheet first, then sync to the current one.
    if (prevInvestmentId !== undefined && prevInvestmentId !== investmentId) {
      await removeTransferFromSheet({ transferId, investmentId: prevInvestmentId })
    }
    await syncSingleTransferToSheet({ transferId })
  })
  return doc
}

export const syncSheetAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  const investmentId = resolveId(doc.investment)
  if (doc.type !== 'INVESTMENT_EXPENSE' || investmentId === undefined) return doc
  const transferId = doc.id as number
  after(async () => {
    const { removeTransferFromSheet } = await import('@/lib/actions/sheets-sync')
    await removeTransferFromSheet({ transferId, investmentId })
  })
  return doc
}
