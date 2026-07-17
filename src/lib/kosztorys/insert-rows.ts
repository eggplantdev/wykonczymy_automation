import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'

// The two shared bulk-insert primitives for a kosztorys tree's section and item rows — the low-level
// mechanism that insertKosztorysTree (restore/apply) and appendPresetSections both compose. Kept in
// one place because the column list + per-row VALUES tuple must move in lockstep with the table on any
// column add/reorder; a copy in each caller is exactly what drifts. Everything that differs between the
// callers — display_order source, old→new id remap, orphan filtering, stages/progress — stays in the
// caller: each takes rows already resolved to the columns it writes, so these two functions carry no
// caller-specific branching. Both run one `INSERT … RETURNING id` on a caller-owned transaction handle
// and return the new ids in VALUES order (Postgres returns RETURNING rows in VALUES order for a single
// INSERT), which is what lets a caller map new ids back to inputs positionally.

// Append slot for a new top-level section = MAX(display_order)+1, not COUNT — a delete leaves a gap,
// so counting would collide with a surviving row. Shared by addSectionAction (single append) and
// appendPresetSections (base offset for a run of preset sections) so the rule lives in one place.
export async function nextSectionDisplayOrder(
  db: DbExecutorT,
  investmentId: number,
): Promise<number> {
  const res = await db.execute(sql`
    SELECT COALESCE(MAX(display_order) + 1, 0) AS next
    FROM kosztorys_sections WHERE investment_id = ${investmentId}
  `)
  return Number(res.rows[0]?.next ?? 0)
}

export async function insertSections(
  db: DbExecutorT,
  investmentId: number,
  rows: { displayOrder: number; section: KosztorysSectionT }[],
): Promise<number[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    ({ displayOrder, section: s }) =>
      sql`(${investmentId}, ${s.name}, ${displayOrder}, ${s.defaultCostVariant}, ${s.wToolsCoeff ?? null}, ${s.ownToolsCoeff ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_sections
      (investment_id, name, display_order, default_cost_variant, w_tools_coeff, own_tools_coeff)
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id
  `)
  return res.rows.map((row) => Number(row.id))
}

// `sectionId` is the row's FINAL (already-resolved) parent id — the caller has mapped the preset's old
// section id through to the freshly-minted one and dropped any orphan (a row whose parent is absent),
// so this inserts exactly what it is given. Items keep their own display_order (the section-level
// offset an append applies is a section concern only).
export async function insertItems(
  db: DbExecutorT,
  investmentId: number,
  rows: { sectionId: number; item: KosztorysItemT }[],
): Promise<number[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    ({ sectionId, item: it }) =>
      sql`(${investmentId}, ${sectionId}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideType ?? null}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideType ?? null}, ${it.ownToolsOverrideValue}, ${it.costVariant ?? null}, ${it.hiddenInExport}, ${it.note ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_items
      (investment_id, section_id, display_order, description, unit, planned_qty,
       discount_type, discount_value, client_price, w_tools_override_type, w_tools_override_value,
       own_tools_override_type, own_tools_override_value, cost_variant, hidden_in_export, note)
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id
  `)
  return res.rows.map((row) => Number(row.id))
}
