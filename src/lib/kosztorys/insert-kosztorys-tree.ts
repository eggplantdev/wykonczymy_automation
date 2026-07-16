import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { getDb } from '@/lib/db/get-db'
import type { SnapshotPayloadT } from './snapshot-format'

type DbHandleT = Awaited<ReturnType<typeof getDb>>

// Bulk-insert a serialized kosztorys tree onto an investment, on a caller-owned transaction handle.
// Shared by restoreKosztorys (wipe → insert → settings) and applyPreset (insert-only) — each caller
// owns the transaction and adds its own wipe/settings semantics around this.
//
// ONE bulk `INSERT … RETURNING id` per level, not row-by-row payload.create: a ~1000-row restore was
// ~12.6s paying Payload's full per-doc cost (validate + hooks + create machinery) ×N, serially. Raw
// insert on the tx-scoped handle loses nothing (the rows were valid when captured) and drops it well
// under a second. Old→new id maps come from RETURNING, which Postgres returns in VALUES order for a
// single INSERT. Insert order is FK-safe: sections → items → stages → progress. Tolerant
// deserialization: missing arrays default to empty; a child whose parent is absent is skipped rather
// than orphaned, so an older payload survives an additive migration.
export async function insertKosztorysTree(
  db: DbHandleT,
  investmentId: number,
  tree: SnapshotPayloadT,
): Promise<void> {
  const sections = tree.sections ?? []
  const sectionIdMap = new Map<number, number>()
  if (sections.length > 0) {
    const rows = sections.map(
      (s) =>
        sql`(${investmentId}, ${s.name}, ${s.displayOrder}, ${s.defaultCostVariant}, ${s.wToolsCoeff ?? null}, ${s.ownToolsCoeff ?? null})`,
    )
    const res = await db.execute(sql`
      INSERT INTO kosztorys_sections
        (investment_id, name, display_order, default_cost_variant, w_tools_coeff, own_tools_coeff)
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id
    `)
    res.rows.forEach((row, i) => sectionIdMap.set(sections[i].id, Number(row.id)))
  }

  // Skip an item whose parent section is absent from the payload (would orphan the FK).
  const items = (tree.items ?? []).filter((it) => sectionIdMap.has(it.sectionId))
  const itemIdMap = new Map<number, number>()
  if (items.length > 0) {
    const rows = items.map(
      (it) =>
        sql`(${investmentId}, ${sectionIdMap.get(it.sectionId)}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideType ?? null}, ${it.ownToolsOverrideValue}, ${it.costVariant ?? null}, ${it.hiddenInExport}, ${it.note ?? null})`,
    )
    const res = await db.execute(sql`
      INSERT INTO kosztorys_items
        (investment_id, section_id, display_order, description, unit, planned_qty,
         discount_type, discount_value, client_price, w_tools_override_type, w_tools_override_value,
         own_tools_override_type, own_tools_override_value, cost_variant, hidden_in_export, note)
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id
    `)
    res.rows.forEach((row, i) => itemIdMap.set(items[i].id, Number(row.id)))
  }

  const stages = tree.stages ?? []
  const stageIdMap = new Map<number, number>()
  if (stages.length > 0) {
    const rows = stages.map((s) => sql`(${investmentId}, ${s.ordinal}, ${s.label ?? null})`)
    const res = await db.execute(sql`
      INSERT INTO kosztorys_stages (investment_id, ordinal, label)
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id
    `)
    res.rows.forEach((row, i) => stageIdMap.set(stages[i].id, Number(row.id)))
  }

  // Skip a progress row whose item or stage is absent (dangling FK).
  const progress = (tree.progress ?? []).filter(
    (p) => itemIdMap.has(p.itemId) && stageIdMap.has(p.stageId),
  )
  if (progress.length > 0) {
    const rows = progress.map(
      (p) => sql`(${itemIdMap.get(p.itemId)}, ${stageIdMap.get(p.stageId)}, ${p.qtyDone})`,
    )
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done)
      VALUES ${sql.join(rows, sql.raw(', '))}
    `)
  }
}
