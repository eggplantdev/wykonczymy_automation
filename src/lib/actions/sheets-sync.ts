'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import {
  appendMaterialRow,
  deleteMaterialRowByTransferId,
  readMaterialyTransferIds,
} from '@/lib/google/sheets'
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

type ToDeleteT = { transferId: number; rowIndex: number }
type OrphanT = { transferIdInSheet: number; rowIndex: number }

export type MaterialSyncPreviewT = {
  toAppend: AppRowT[]
  toDelete: ToDeleteT[]
  orphans: OrphanT[]
  spreadsheetId: string
}

export type ApplyMaterialSyncResultT = {
  added: number
  deleted: number
  skipped: number
  errors: Array<{ transferId: number; message: string }>
}

async function loadAppMaterialRows(
  payload: Awaited<ReturnType<typeof getPayload>>,
  investmentId: number,
): Promise<AppRowT[]> {
  const result = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { investment: { equals: investmentId } },
        { type: { equals: 'INVESTMENT_EXPENSE' } },
        { cancelled: { not_equals: true } },
      ],
    },
    depth: 1,
    limit: 1000,
    overrideAccess: true,
  })

  const rows: AppRowT[] = []
  for (const t of result.docs) {
    const typ =
      typeof t.expenseCategory === 'object' && t.expenseCategory !== null
        ? (t.expenseCategory as { name?: string }).name
        : undefined
    if (!typ) continue

    const otherCategoryName =
      typeof t.otherCategory === 'object' && t.otherCategory !== null
        ? ((t.otherCategory as { name?: string }).name ?? '')
        : ''

    rows.push({
      transferId: t.id,
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '',
      typ,
      description: t.description ?? '',
      amount: Number(t.amount),
      category: otherCategoryName,
      note: t.invoiceNote ?? '',
    })
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

    const appIds = new Set(appRows.map((r) => r.transferId))
    const toAppend = appRows.filter((r) => !sheetIds.has(r.transferId))
    const toDelete: ToDeleteT[] = []
    const orphans: OrphanT[] = []

    for (const [transferId, rowIndex] of sheetIds.entries()) {
      if (appIds.has(transferId)) continue
      // Present in sheet but not in active app rows — could be cancelled
      // (still in DB, just cancelled=true) or never existed (true orphan,
      // likely owner-typed by hand).
      const probe = await payload.findByID({
        collection: 'transactions',
        id: transferId,
        disableErrors: true,
        overrideAccess: true,
      })
      if (probe) {
        toDelete.push({ transferId, rowIndex })
      } else {
        orphans.push({ transferIdInSheet: transferId, rowIndex })
      }
    }

    return {
      success: true,
      data: { toAppend, toDelete, orphans, spreadsheetId: sheetId },
    }
  })
}

export async function applyMaterialSync(investmentId: number, preview: MaterialSyncPreviewT) {
  return protectedAction<ApplyMaterialSyncResultT>(
    'applyMaterialSync',
    async ({ payload }) => {
      const investment = await payload.findByID({
        collection: 'investments',
        id: investmentId,
        overrideAccess: true,
      })
      if (!investment?.googleSheetId || investment.googleSheetId !== preview.spreadsheetId) {
        return {
          success: false,
          error: 'Powiązanie arkusza zmieniło się — uruchom podgląd ponownie.',
        }
      }
      const sheetId = investment.googleSheetId

      // Re-read col I once; idempotency guard for appends whose row may already exist.
      const current = await readMaterialyTransferIds(sheetId)
      let added = 0
      let deleted = 0
      let skipped = 0
      const errors: ApplyMaterialSyncResultT['errors'] = []

      for (const row of preview.toAppend) {
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

      for (const row of preview.toDelete) {
        // No pre-check — deleteMaterialRowByTransferId re-reads col I and
        // is a no-op when the row is gone; earlier appends may have shifted indices.
        try {
          const res = await deleteMaterialRowByTransferId(sheetId, row.transferId)
          if (res.deleted) deleted++
          else skipped++
        } catch (err) {
          errors.push({ transferId: row.transferId, message: String(err) })
        }
      }

      return { success: true, data: { added, deleted, skipped, errors } }
    },
    ['transfers'],
  )
}

/**
 * Single-transfer sync, called fire-and-forget from create/cancel server actions.
 * intent='CREATE' → append if not already present. intent='DELETE' → delete if present.
 * Never throws; logs and swallows errors so the calling action's UX is unaffected.
 */
export async function syncSingleTransferToSheet(params: {
  transferId: number
  intent: 'CREATE' | 'DELETE'
}): Promise<void> {
  try {
    const payload = await getPayload({ config })

    const transfer = await payload.findByID({
      collection: 'transactions',
      id: params.transferId,
      depth: 1,
      overrideAccess: true,
    })
    if (!transfer) return
    if (transfer.type !== 'INVESTMENT_EXPENSE') return

    const investmentId =
      typeof transfer.investment === 'number'
        ? transfer.investment
        : (transfer.investment as { id: number } | null)?.id
    if (!investmentId) return

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

    if (params.intent === 'DELETE') {
      const res = await deleteMaterialRowByTransferId(sheetId, params.transferId)
      console.log(
        `[sheets-sync] delete transfer #${params.transferId} → sheet ${sheetId} (deleted=${res.deleted})`,
      )
      return
    }

    const typ =
      typeof transfer.expenseCategory === 'object' && transfer.expenseCategory !== null
        ? (transfer.expenseCategory as { name?: string }).name
        : undefined
    if (!typ) return

    const existing = await readMaterialyTransferIds(sheetId)
    if (existing.has(params.transferId)) return

    const categoryLabel =
      typeof transfer.otherCategory === 'object' && transfer.otherCategory !== null
        ? ((transfer.otherCategory as { name?: string }).name ?? '')
        : ''

    await appendMaterialRow(sheetId, {
      transferId: params.transferId,
      date: transfer.date ? new Date(transfer.date).toISOString().slice(0, 10) : '',
      typ,
      description: transfer.description ?? '',
      amount: Number(transfer.amount),
      category: categoryLabel,
      note: transfer.invoiceNote ?? '',
    })
    console.log(`[sheets-sync] append transfer #${params.transferId} → sheet ${sheetId} (${typ})`)
  } catch (err) {
    console.error('[sheets-sync] failed (non-fatal):', err)
  }
}
