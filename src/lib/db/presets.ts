// No `server-only` here (half of src/lib/db skips it too): the katalog seed script reaches this
// module under tsx, where that import throws.
import { sql } from '@payloadcms/db-vercel-postgres'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import type { DbExecutorT } from './get-db'
import { isoOrNull } from './row-coerce'

// A szablon is an investment with status `szablon`; its kosztorys tree is the szablon's content and
// is read through the kosztorys path (`serializeKosztorysAsPreset`), never here. This module owns
// only what the pickers and the /szablony list show about one.
//
// Every reader here answers for a LIVE szablon: one in the trash (`trashed_at`) is absent from the
// list, the pickers and every write that names it, until it is restored. The name checks are the
// exception — the unique index still counts a trashed szablon, so they must too.

export type PresetMetaT = {
  // The investment's id.
  id: number
  name: string
  createdAt: string
  // `content_edited_at`, not `updated_at`: the latter is the editor's remount token and moves on
  // things that are not edits. `null` only on a szablon migrated from a row that never had a stamp.
  updatedAt: string | null
}

// One row per LIVE section across all szablony. `sectionId` is a real kosztorys_sections id, so it
// names its szablon on its own; `presetId` rides along for the picker's grouping.
export type PresetSectionMetaT = {
  presetId: number
  presetName: string
  sectionId: number
  sectionName: string
  itemCount: number
}

const LIVE_TEMPLATE = sql`status = ${TEMPLATE_INVESTMENT_STATUS} AND trashed_at IS NULL`

export async function isTemplateInvestment(db: DbExecutorT, id: number): Promise<boolean> {
  const res = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id} AND ${LIVE_TEMPLATE}`)
  return res.rows.length > 0
}

export async function getPresetName(db: DbExecutorT, id: number): Promise<string | null> {
  const res = await db.execute(
    sql`SELECT name FROM investments WHERE id = ${id} AND ${LIVE_TEMPLATE}`,
  )
  const row = res.rows[0]
  return row ? String(row.name) : null
}

// The comparison `investments_szablon_name_idx` enforces, so a create path can word the refusal in
// Polish before the index answers with the driver's English 23505.
const SAME_NAME = (name: string) => sql`lower(trim(name)) = lower(trim(${name}))`

export type PresetNameHolderT = 'live' | 'trashed'

// Which szablon holds the name, if any. A trashed holder is told apart because the user cannot see
// it: „already exists" would point at a szablon missing from the list.
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
// A rename is an edit as far as the list is concerned: it moves the row to the top.
// `false` = the name is taken or the id is not a live szablon; both mean „nothing was renamed".
export async function renamePreset(db: DbExecutorT, id: number, name: string): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE investments SET name = ${name}, content_edited_at = now()
    WHERE id = ${id} AND ${LIVE_TEMPLATE}
      AND NOT EXISTS (
        SELECT 1 FROM investments
        WHERE status = ${TEMPLATE_INVESTMENT_STATUS} AND ${SAME_NAME(name)} AND id <> ${id}
      )
    RETURNING id
  `)
  return res.rows.length > 0
}

// Section id → the szablon that owns it. A section of an ordinary investment is simply absent, so the
// caller cannot be talked into copying one by an id.
export async function templateOwnersOfSections(
  db: DbExecutorT,
  sectionIds: readonly number[],
): Promise<Map<number, number>> {
  if (sectionIds.length === 0) return new Map()
  const res = await db.execute(sql`
    SELECT s.id, s.investment_id
    FROM kosztorys_sections s
    JOIN investments inv ON inv.id = s.investment_id
    WHERE inv.status = ${TEMPLATE_INVESTMENT_STATUS} AND inv.trashed_at IS NULL
      AND s.id IN (${sql.join(
        sectionIds.map((id) => sql`${id}`),
        sql.raw(', '),
      )})
  `)
  return new Map(res.rows.map((row) => [Number(row.id), Number(row.investment_id)]))
}

// The list sorts by the last edit, and a szablon created a second ago is the one about to be opened.
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
    WHERE inv.status = ${TEMPLATE_INVESTMENT_STATUS} AND inv.trashed_at IS NULL
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
    WHERE ${LIVE_TEMPLATE}
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
