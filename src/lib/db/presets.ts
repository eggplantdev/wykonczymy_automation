// No `server-only` here: the katalog seed script reaches this module under tsx, where that import
// throws.
import { sql } from '@payloadcms/db-postgres'
import { sqlList } from '@/lib/db/sql-list'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import type { DbExecutorT } from './get-db'
import { isoOrNull } from './row-coerce'

export type PresetMetaT = {
  id: number
  name: string
  createdAt: string
  // `content_edited_at`, not `updated_at`: the latter is the editor's remount token and moves on
  // things that are not edits.
  updatedAt: string | null
}

export type PresetSectionMetaT = {
  presetId: number
  presetName: string
  sectionId: number
  sectionName: string
  itemCount: number
}

const liveTemplate = (alias?: string) => {
  const column = (name: string) => sql.raw(alias ? `${alias}.${name}` : name)
  return sql`${column('status')} = ${TEMPLATE_INVESTMENT_STATUS} AND ${column('trashed_at')} IS NULL`
}

export async function isTemplateInvestment(db: DbExecutorT, id: number): Promise<boolean> {
  const res = await db.execute(
    sql`SELECT 1 FROM investments WHERE id = ${id} AND ${liveTemplate()}`,
  )
  return res.rows.length > 0
}

export async function getPresetName(db: DbExecutorT, id: number): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT name FROM investments WHERE id = ${id} AND ${liveTemplate()}`,
  )
  const row = res.rows[0]
  return row ? String(row.name) : null
}

// The comparison `investments_szablon_name_idx` enforces, so a create path can word the refusal in
// Polish before the index answers with the driver's English 23505.
const SAME_NAME = (name: string) => sql`lower(trim(name)) = lower(trim(${name}))`

export type PresetNameHolderT = 'live' | 'trashed'

export async function presetNameHolder(
  db: DbExecutorT,
  name: string,
  exceptId?: number,
): Promise<PresetNameHolderT | undefined> {
  const res = await db.execute(sql`
    SELECT trashed_at FROM investments
    WHERE status = ${TEMPLATE_INVESTMENT_STATUS} AND ${SAME_NAME(name)}
      ${exceptId == null ? sql`` : sql`AND id <> ${exceptId}`}
    LIMIT 1
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return row.trashed_at == null ? 'live' : 'trashed'
}

// Raw SQL rather than `payload.update`, which would bump `updated_at` — the editor's remount token.
export async function renamePreset(db: DbExecutorT, id: number, name: string): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE investments SET name = ${name}, content_edited_at = now()
    WHERE id = ${id} AND ${liveTemplate()}
      AND NOT EXISTS (
        SELECT 1 FROM investments
        WHERE status = ${TEMPLATE_INVESTMENT_STATUS} AND ${SAME_NAME(name)} AND id <> ${id}
      )
    RETURNING id
  `)
  return res.rows.length > 0
}

// A section of an ordinary investment is simply absent, so the caller cannot be talked into copying
// one by an id.
export async function templateOwnersOfSections(
  db: DbExecutorT,
  sectionIds: readonly number[],
): Promise<Map<number, number>> {
  if (sectionIds.length === 0) return new Map()
  const res = await db.execute(sql`
    SELECT s.id, s.investment_id
    FROM kosztorys_sections s
    JOIN investments inv ON inv.id = s.investment_id
    WHERE ${liveTemplate('inv')}
      AND s.id IN (${sqlList(sectionIds)})
  `)
  return new Map(res.rows.map((row) => [Number(row.id), Number(row.investment_id)]))
}

export async function listTemplateNamesUsingCatalogueItem(
  db: DbExecutorT,
  catalogueItemId: number,
): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT inv.name
    FROM kosztorys_items ki
    JOIN investments inv ON inv.id = ki.investment_id
    WHERE ki.catalogue_item_id = ${catalogueItemId} AND ${liveTemplate('inv')}
    ORDER BY inv.name
  `)
  return res.rows.map((row) => String(row.name))
}

export async function listTemplateNamesByCatalogueItem(
  db: DbExecutorT,
): Promise<Record<number, string[]>> {
  const res = await db.execute(sql`
    SELECT ki.catalogue_item_id, array_agg(DISTINCT inv.name ORDER BY inv.name) AS names
    FROM kosztorys_items ki
    JOIN investments inv ON inv.id = ki.investment_id
    WHERE ki.catalogue_item_id IS NOT NULL AND ${liveTemplate('inv')}
    GROUP BY ki.catalogue_item_id
  `)
  return Object.fromEntries(
    res.rows.map((row) => [Number(row.catalogue_item_id), (row.names as unknown[]).map(String)]),
  )
}

// Trashed szablony included: one restored later must not bring back a praca whose content is gone.
export async function deleteTemplateRowsOfCatalogueItem(
  db: DbExecutorT,
  catalogueItemId: number,
): Promise<number[]> {
  const res = await db.execute(sql`
    DELETE FROM kosztorys_items ki
    USING investments inv
    WHERE inv.id = ki.investment_id
      AND inv.status = ${TEMPLATE_INVESTMENT_STATUS}
      AND ki.catalogue_item_id = ${catalogueItemId}
    RETURNING ki.investment_id
  `)
  return [...new Set(res.rows.map((row) => Number(row.investment_id)))]
}

export async function markPresetEdited(db: DbExecutorT, id: number): Promise<void> {
  await db.execute(sql`UPDATE investments SET content_edited_at = now() WHERE id = ${id}`)
}

// The picker's grouping needs one szablon's sections CONSECUTIVELY, hence the szablon keys lead the
// ORDER BY.
export async function listPresetSections(db: DbExecutorT): Promise<PresetSectionMetaT[]> {
  const res = await db.execute(sql`
    SELECT
      inv.id            AS preset_id,
      inv.name          AS preset_name,
      s.id              AS section_id,
      s.name            AS section_name,
      COUNT(it.id)      AS item_count
    FROM investments inv
    JOIN kosztorys_sections s ON s.investment_id = inv.id
    LEFT JOIN kosztorys_items it ON it.section_id = s.id
    WHERE ${liveTemplate('inv')}
    GROUP BY inv.id, s.id
    ORDER BY inv.created_at DESC, inv.id DESC, s.display_order, s.id
  `)
  return res.rows.map((row) => ({
    presetId: Number(row.preset_id),
    presetName: String(row.preset_name),
    sectionId: Number(row.section_id),
    sectionName: String(row.section_name),
    itemCount: Number(row.item_count),
  }))
}

export async function listPresets(db: DbExecutorT): Promise<PresetMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, name, created_at, content_edited_at
    FROM investments
    WHERE ${liveTemplate()}
    -- Sorted by the last edit, because that is what moves: a szablon is created once and worked on
    -- for weeks. NULLS LAST keeps a szablon migrated without a stamp in the list, below the live
    -- ones, ordered among themselves by creation.
    ORDER BY content_edited_at DESC NULLS LAST, created_at DESC, id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    createdAt: isoOrNull(row.created_at) ?? '',
    updatedAt: isoOrNull(row.content_edited_at),
  }))
}
