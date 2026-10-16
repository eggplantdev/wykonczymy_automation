import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { after } from 'next/server'
import { EXPENSES_TAB_TYPES, SHEET_TRANSFER_TAB_TYPES } from '@/lib/constants/transfers'
import { resolveId } from '@/lib/utils/resolve-id'

// sheets-sync is a 'use server' module (it pulls in `server-only` + the Payload
// config), so it's imported LAZILY inside after() — a static import here would poison
// the transactions collection's import graph for client/test contexts that load it.

const SHEET_SYNCED_TYPES: string[] = [...EXPENSES_TAB_TYPES, ...SHEET_TRANSFER_TAB_TYPES]

export const syncSheetAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc, context }) => {
  if (context?.skipSheetSync) return doc
  if (!SHEET_SYNCED_TYPES.includes(doc.type)) return doc

  const transferId = doc.id as number
  const prevInvestmentId = resolveId(previousDoc?.investment)
  const investmentId = resolveId(doc.investment)

  after(async () => {
    const { removeTransferFromSheet, syncSingleTransferToSheet } =
      await import('@/lib/actions/sheets-sync')
    if (prevInvestmentId !== undefined && prevInvestmentId !== investmentId) {
      await removeTransferFromSheet({ transferId, investmentId: prevInvestmentId, type: doc.type })
    }
    await syncSingleTransferToSheet({ transferId })
  })
  return doc
}

export const syncSheetAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  const investmentId = resolveId(doc.investment)
  if (!SHEET_SYNCED_TYPES.includes(doc.type) || investmentId === undefined) return doc
  const transferId = doc.id as number
  after(async () => {
    const { removeTransferFromSheet } = await import('@/lib/actions/sheets-sync')
    await removeTransferFromSheet({ transferId, investmentId, type: doc.type })
  })
  return doc
}
