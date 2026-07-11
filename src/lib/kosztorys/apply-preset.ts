import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { SnapshotPayloadT } from './snapshot-format'

// Populate an EMPTY investment's kosztorys from a preset payload. A fork of `restoreKosztorys` with
// two deliberate omissions: (1) NO wipe — the caller guarantees the target tree is empty, so we only
// insert; (2) NO settings write-back — a preset must not carry one job's VAT/coeffs onto another
// investment (the preset's `settings` block is retained for shape-parity but ignored here). THE
// CALLER OWNS THE TRANSACTION — `req` carries the `transactionID`; a throw anywhere rolls it all back.
//
// Same bulk `INSERT … RETURNING id` per level + old→new id remap as the restore path (Postgres
// returns RETURNING rows in VALUES order for a single INSERT). Insert order is FK-safe: sections →
// items → stages → progress. Tolerant deserialization: missing arrays default to empty, children
// whose parent is absent are skipped rather than orphaned — an older preset survives an additive
// migration. A preset serialized via `serializeKosztorysAsPreset` carries no progress, but the
// progress block is kept so `applyPreset` stays a general payload applier.
export async function applyPreset(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  preset: SnapshotPayloadT,
): Promise<void> {
  const db = await getDb(payload, req) // transaction-scoped Drizzle handle (req carries transactionID)

  const sections = preset.sections ?? []
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

  // Skip an item whose parent section is absent from the preset (would orphan the FK).
  const items = (preset.items ?? []).filter((it) => sectionIdMap.has(it.sectionId))
  const itemIdMap = new Map<number, number>()
  if (items.length > 0) {
    const rows = items.map(
      (it) =>
        sql`(${investmentId}, ${sectionIdMap.get(it.sectionId)}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.measuredQty}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideType ?? null}, ${it.ownToolsOverrideValue}, ${it.costVariant ?? null}, ${it.hiddenInExport}, ${it.note ?? null})`,
    )
    const res = await db.execute(sql`
      INSERT INTO kosztorys_items
        (investment_id, section_id, display_order, description, unit, planned_qty, measured_qty,
         discount_type, discount_value, client_price, w_tools_override_type, w_tools_override_value,
         own_tools_override_type, own_tools_override_value, cost_variant, hidden_in_export, note)
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id
    `)
    res.rows.forEach((row, i) => itemIdMap.set(items[i].id, Number(row.id)))
  }

  const stages = preset.stages ?? []
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
  const progress = (preset.progress ?? []).filter(
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
