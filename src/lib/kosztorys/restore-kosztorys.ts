import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { SnapshotPayloadT } from './snapshot-format'

// Atomically revert an investment's whole kosztorys to a serialized snapshot: wipe the live tree,
// re-insert from the payload remapping child FKs to freshly-minted parent ids, then rewrite the
// three investment editor-settings. THE CALLER OWNS THE TRANSACTION — pass a `req` carrying a
// `transactionID` (and optional `context`, e.g. `skipRevalidation`); every op below threads it so a
// throw anywhere rolls the whole thing back and the live tree is never left half-wiped.
//
// The re-insert is ONE bulk `INSERT … RETURNING id` per level, not row-by-row `payload.create`:
// a ~1000-row restore was ~12.6s because each create paid Payload's full per-doc cost (validate +
// hooks + create machinery) ×N, serially. The only hooks here are cache revalidation, already
// suppressed by `skipRevalidation` and redone once by the action; validation is redundant (the
// snapshot is a copy of rows that were valid when captured). So raw insert on the tx-scoped handle
// loses nothing and drops the restore to well under a second. Old→new id maps come from the
// RETURNING rows, which Postgres returns in VALUES order for a single INSERT.
//
// Insert order is FK-safe: sections → items (need a section) → stages → progress (needs item+stage).
// Tolerant deserialization: missing arrays default to empty, and children whose parent is absent
// from the snapshot are skipped rather than orphaned — so a later additive migration doesn't break
// an older snapshot.
export async function restoreKosztorys(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  snapshot: SnapshotPayloadT,
): Promise<void> {
  const db = await getDb(payload, req) // transaction-scoped Drizzle handle (req carries transactionID)
  const where = { investment: { equals: investmentId } }

  // Wipe. Deleting sections DB-cascades their items → stage_progress; deleting stages cascades any
  // remaining stage_progress. Order between the two is immaterial — cascades cover both directions.
  await payload.delete({ collection: 'kosztorys-sections', where, req })
  await payload.delete({ collection: 'kosztorys-stages', where, req })

  const sections = snapshot.sections ?? []
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

  // Skip an item whose parent section is absent from the snapshot (would orphan the FK).
  const items = (snapshot.items ?? []).filter((it) => sectionIdMap.has(it.sectionId))
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

  const stages = snapshot.stages ?? []
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
  const progress = (snapshot.progress ?? []).filter(
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

  await payload.update({
    collection: 'investments',
    id: investmentId,
    req,
    data: {
      wToolsCoeff: snapshot.settings.wToolsCoeff,
      ownToolsCoeff: snapshot.settings.ownToolsCoeff,
      vatRate: snapshot.settings.vatRate,
    },
  })
}
