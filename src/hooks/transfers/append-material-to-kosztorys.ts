import type { CollectionAfterChangeHook } from 'payload'
import { getWorkbook, putWorkbook, workbookExists } from '@/lib/kosztorys/blob'
import { appendMaterialRow, type AppendMaterialInputT } from '@/lib/kosztorys/append-material'
import type { MaterialKindT } from '@/lib/kosztorys/types'

const MATERIAL_CATEGORY_KIND: Record<string, MaterialKindT> = {
  'Materiały budowlane': 'budowlane',
  'Materiały wykończeniowe': 'wykończeniowe',
}

function resolveId(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: number }).id
  }
  return undefined
}

/**
 * afterChange — when a new INVESTMENT_EXPENSE with category Materiały budowlane
 * or wykończeniowe is created on an investment that has a kosztorys workbook
 * stored in Blob, append a row to the materiały tab.
 *
 * Fire-and-forget by design: failure logs but never throws, so a Blob
 * outage cannot block a transfer commit. This matches the outbox pattern's
 * isolation goal even without a real outbox table yet.
 */
export const appendMaterialToKosztorys: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  try {
    if (operation !== 'create') return doc
    if (doc.type !== 'INVESTMENT_EXPENSE') return doc

    const investmentId = resolveId(doc.investment)
    if (!investmentId) return doc

    const categoryId = resolveId(doc.expenseCategory)
    if (!categoryId) return doc

    // resolve category name → material kind
    const category = await req.payload.findByID({
      collection: 'expense-categories',
      id: categoryId,
      overrideAccess: true,
    })
    const kind = category?.name ? MATERIAL_CATEGORY_KIND[category.name] : undefined
    if (!kind) return doc

    if (!(await workbookExists(investmentId))) {
      console.log(
        `[kosztorys-sync] skip transfer #${doc.id}: no workbook seeded for investment #${investmentId}`,
      )
      return doc
    }

    const workbook = await getWorkbook(investmentId)
    if (!workbook) return doc

    const input: AppendMaterialInputT = {
      kind,
      amount: Number(doc.amount),
      description: doc.description ?? '',
      transferId: doc.id,
      date: doc.date ? new Date(doc.date).toISOString().slice(0, 10) : undefined,
    }

    const result = appendMaterialRow(workbook, input)
    if (!result.ok) {
      console.warn(`[kosztorys-sync] could not append transfer #${doc.id} (${result.reason})`)
      return doc
    }

    await putWorkbook(investmentId, workbook)
    console.log(
      `[kosztorys-sync] appended transfer #${doc.id} → investment #${investmentId} ${result.cellA1}`,
    )
  } catch (err) {
    console.error('[kosztorys-sync] failed (non-fatal):', err)
  }

  return doc
}
