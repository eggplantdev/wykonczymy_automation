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
// caller-specific branching.
//
// Both return the new ids IN INPUT ORDER, which is what lets a caller zip them back to its inputs
// positionally. That order is reconstructed by joining RETURNING on each row's natural key rather than
// by trusting Postgres's row order: VALUES-order RETURNING holds for a plain INSERT today but is not
// SQL-guaranteed (partitioning, or a rewrite to `INSERT … SELECT`, may reorder), and the failure would
// be silent — every id is a valid id, so children would reparent to the wrong rows with no error.
export const SECTION_INSERT_COLUMNS = ['investment_id', 'name', 'display_order', 'color'] as const

export const ITEM_INSERT_COLUMNS = [
  'investment_id',
  'section_id',
  'display_order',
  'description',
  'unit',
  'planned_qty',
  'sheet_measured_qty',
  'discount_type',
  'discount_value',
  'client_price',
  'w_tools_override_value',
  'own_tools_override_value',
  'w_tools_override_coeff',
  'own_tools_override_coeff',
  'note',
] as const

// Natural keys, unique within one insert batch ONLY BY CONVENTION: a section by its display_order, an
// item by (section_id, display_order). Neither carries a UNIQUE constraint — a tie is a tolerated
// state here (appendPresetSections knowingly races on a MAX select, and the read path orders by
// `(display_order, id)` so a tie only makes relative order ambiguous). Only kosztorys_stages.ordinal
// is constraint-backed.
const itemKey = (sectionId: number, displayOrder: number) => `${sectionId}:${displayOrder}`

/**
 * Map RETURNING ids back into input order via the natural key, degrading to positional order when
 * that key ties.
 *
 * The degrade is the point: refusing to insert a tied batch would turn a state the rest of the system
 * treats as benign into a dead restore — the snapshot preserves display_order verbatim, so the tie
 * comes back on every attempt with no UI path to repair it. Positional is what this code did before
 * the key join existed and is correct for a plain `INSERT … VALUES`, so the fallback is the old
 * behaviour, not a new risk; the key join is the strictly-better path taken whenever it is available.
 */
export function remapNewIds<K>(
  returned: Record<string, unknown>[],
  keyOf: (row: Record<string, unknown>) => K,
  inputKeys: K[],
  table: string,
): number[] {
  if (returned.length !== inputKeys.length) {
    throw new Error(
      `${table}: INSERT returned ${returned.length} ids for ${inputKeys.length} rows sent`,
    )
  }

  const byKey = new Map<K, number>()
  for (const row of returned) byKey.set(keyOf(row), Number(row.id))

  if (byKey.size !== returned.length) {
    // TODO(EX-449) SENTRY-REQUIRED: a tie is legal but rare enough to be worth seeing.
    console.error(
      `${table}: natural key ties within the insert batch (${byKey.size} distinct keys for ${returned.length} rows) — falling back to positional id mapping`,
    )
    return returned.map((row) => Number(row.id))
  }

  return inputKeys.map((key) => {
    const id = byKey.get(key)
    if (id === undefined) {
      throw new Error(`${table}: INSERT returned no id for natural key ${String(key)}`)
    }
    return id
  })
}

export async function insertSections(
  db: DbExecutorT,
  investmentId: number,
  // `Omit<…, 'displayOrder'>`: the caller passes display_order separately (an append offsets it), and
  // a section read out of a stored payload may not carry the key at all.
  rows: { displayOrder: number; section: Omit<KosztorysSectionT, 'displayOrder'> }[],
): Promise<number[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    ({ displayOrder, section: s }) =>
      sql`(${investmentId}, ${s.name}, ${displayOrder}, ${s.color ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_sections (${sql.raw(SECTION_INSERT_COLUMNS.join(', '))})
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id, display_order
  `)
  return remapNewIds(
    res.rows,
    (row) => Number(row.display_order),
    rows.map(({ displayOrder }) => displayOrder),
    'kosztorys_sections',
  )
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
      sql`(${investmentId}, ${sectionId}, ${it.displayOrder}, ${it.description ?? null}, ${it.unit ?? null}, ${it.plannedQty}, ${it.sheetMeasuredQty ?? null}, ${it.discountType ?? null}, ${it.discountValue}, ${it.clientPrice}, ${it.wToolsOverrideValue}, ${it.ownToolsOverrideValue}, ${it.wToolsOverrideCoeff}, ${it.ownToolsOverrideCoeff}, ${it.note ?? null})`,
  )
  const res = await db.execute(sql`
    INSERT INTO kosztorys_items (${sql.raw(ITEM_INSERT_COLUMNS.join(', '))})
    VALUES ${sql.join(values, sql.raw(', '))}
    RETURNING id, section_id, display_order
  `)
  return remapNewIds(
    res.rows,
    (row) => itemKey(Number(row.section_id), Number(row.display_order)),
    rows.map(({ sectionId, item }) => itemKey(sectionId, item.displayOrder)),
    'kosztorys_items',
  )
}
