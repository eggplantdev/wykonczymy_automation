import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import type { KosztorysItemT, KosztorysSectionT } from '@/types/kosztorys'

// One section from a preset payload + its items, ready to append. `section`/`items` still carry the
// preset's OLD ids — this helper mints new ones and returns the remapped slice.
export type SectionSliceT = { section: KosztorysSectionT; items: KosztorysItemT[] }

// The created slice with NEW ids, in the nested shape getKosztorysTree yields (section + its items),
// so the client can build grid rows without a refetch.
export type AppendedSliceT = (KosztorysSectionT & { items: KosztorysItemT[] })[]

// Append the chosen sections + their items to a (possibly non-empty) kosztorys, after the last
// section. Deliberately NOT a fork of applyPreset (EX-438): sections+items only — a section append
// has no stages/progress/settings. THE CALLER OWNS THE TRANSACTION (`req` carries the transactionID);
// a throw anywhere rolls it all back. Same bulk `INSERT … RETURNING id` + VALUES-order id remap as
// apply-preset.ts (Postgres returns RETURNING rows in VALUES order for a single INSERT).
//
// displayOrder base = MAX(display_order)+1 read inside the same transaction, then base+i per section.
// Concurrent appends can read the same base (no lock on a MAX select, no UNIQUE) — accepted, same
// class as seed-from-preset's empty-guard race: a duplicate display_order only makes relative order
// ambiguous, nothing corrupts.
export async function appendPresetSections(
  payload: Payload,
  req: PayloadRequest,
  investmentId: number,
  slices: SectionSliceT[],
): Promise<AppendedSliceT> {
  if (slices.length === 0) return []
  const db = await getDb(payload, req)

  const baseRes = await db.execute(sql`
    SELECT COALESCE(MAX(display_order) + 1, 0) AS next
    FROM kosztorys_sections WHERE investment_id = ${investmentId}
  `)
  const base = Number(baseRes.rows[0]?.next ?? 0)

  const sectionRows = slices.map(({ section: s }, i) => {
    return sql`(${investmentId}, ${s.name}, ${base + i}, ${s.defaultCostVariant}, ${s.wToolsCoeff ?? null}, ${s.ownToolsCoeff ?? null})`
  })
  const sectionRes = await db.execute(sql`
    INSERT INTO kosztorys_sections
      (investment_id, name, display_order, default_cost_variant, w_tools_coeff, own_tools_coeff)
    VALUES ${sql.join(sectionRows, sql.raw(', '))}
    RETURNING id
  `)
  const newSectionIds = sectionRes.rows.map((row) => Number(row.id))

  // Flatten items in slice order with their NEW section id (items keep the preset's per-section
  // display_order — the offset is a section-level concern only).
  const flatItems: { newSectionId: number; item: KosztorysItemT }[] = []
  slices.forEach((slice, i) => {
    for (const item of slice.items) flatItems.push({ newSectionId: newSectionIds[i], item })
  })

  const newItemIds: number[] = []
  if (flatItems.length > 0) {
    const itemRows = flatItems.map(
      ({ newSectionId, item: it }) =>
        sql`(${investmentId}, ${newSectionId}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideType ?? null}, ${it.ownToolsOverrideValue}, ${it.costVariant ?? null}, ${it.hiddenInExport}, ${it.note ?? null})`,
    )
    const itemRes = await db.execute(sql`
      INSERT INTO kosztorys_items
        (investment_id, section_id, display_order, description, unit, planned_qty,
         discount_type, discount_value, client_price, w_tools_override_type, w_tools_override_value,
         own_tools_override_type, own_tools_override_value, cost_variant, hidden_in_export, note)
      VALUES ${sql.join(itemRows, sql.raw(', '))}
      RETURNING id
    `)
    itemRes.rows.forEach((row) => newItemIds.push(Number(row.id)))
  }

  // Rebuild the nested slice with the new ids, consuming newItemIds in the same order they were inserted.
  let cursor = 0
  return slices.map(({ section: s, items }, i) => ({
    id: newSectionIds[i],
    name: s.name,
    displayOrder: base + i,
    defaultCostVariant: s.defaultCostVariant,
    wToolsCoeff: s.wToolsCoeff,
    ownToolsCoeff: s.ownToolsCoeff,
    items: items.map((it) => ({ ...it, id: newItemIds[cursor++], sectionId: newSectionIds[i] })),
  }))
}
