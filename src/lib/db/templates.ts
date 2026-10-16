// No `server-only` here: the katalog seed script reaches this module under tsx, where that import throws.
import { sql } from '@payloadcms/db-postgres'
import { sqlList } from '@/lib/db/sql-list'
import type { DbExecutorT } from './get-db'
import { isoOrNull } from './row-coerce'

// A szablon lives in its own tables (EX-1075): `templates` → `template_sections` → `template_items`,
// each praca a katalog entry at a place. Every reader here answers for a LIVE szablon — one in the
// trash is absent from the list, the pickers and every write that names it, until it is restored.
// The name checks are the exception: `templates_name_idx` counts a trashed szablon, so they must too.

export type TemplateMetaT = {
  id: number
  name: string
  createdAt: string
  // `content_edited_at`, not `updated_at`: the latter is the editor's revision token and moves only
  // when the whole tree is replaced. `null` only on a szablon migrated from a row with no stamp.
  updatedAt: string | null
}

// One row per section across all live szablony; `sectionId` names its szablon on its own.
export type TemplateSectionMetaT = {
  templateId: number
  templateName: string
  sectionId: number
  sectionName: string
  itemCount: number
}

export type TemplateNameHolderT = 'live' | 'trashed'

// The comparison `templates_name_idx` enforces, so a create path can word the refusal in Polish
// before the index answers with the driver's English 23505.
const SAME_NAME = (name: string) => sql`lower(trim(name)) = lower(trim(${name}))`

export async function getTemplateRecordName(
  db: DbExecutorT,
  id: number,
): Promise<string | undefined> {
  const res = await db.execute(
    sql`SELECT name FROM templates WHERE id = ${id} AND trashed_at IS NULL`,
  )
  const row = res.rows[0]
  return row ? String(row.name) : undefined
}

export async function isLiveTemplate(db: DbExecutorT, id: number): Promise<boolean> {
  return (await getTemplateRecordName(db, id)) !== undefined
}

// Which szablon holds the name, if any. A trashed holder is told apart because the user cannot see
// it: „already exists" would point at a szablon missing from the list.
export async function templateNameHolder(
  db: DbExecutorT,
  name: string,
  exceptId?: number,
): Promise<TemplateNameHolderT | undefined> {
  const res = await db.execute(sql`
    SELECT trashed_at FROM templates
    WHERE ${SAME_NAME(name)} ${exceptId == null ? sql`` : sql`AND id <> ${exceptId}`}
    LIMIT 1
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return row.trashed_at == null ? 'live' : 'trashed'
}

// A szablon created a second ago is the one about to be opened, so it is born with the edit stamp.
export async function insertTemplate(db: DbExecutorT, name: string): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO templates (name, content_edited_at) VALUES (${name}, now()) RETURNING id
  `)
  return Number(res.rows[0].id)
}

// `false` = the name is taken or the id is not a live szablon; both mean „nothing was renamed".
// A rename is an edit as far as the list is concerned: it moves the row to the top.
export async function renameTemplate(db: DbExecutorT, id: number, name: string): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE templates SET name = ${name}, content_edited_at = now()
    WHERE id = ${id} AND trashed_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM templates WHERE ${SAME_NAME(name)} AND id <> ${id})
    RETURNING id
  `)
  return res.rows.length > 0
}

export async function markTemplateEdited(db: DbExecutorT, id: number): Promise<void> {
  await db.execute(sql`UPDATE templates SET content_edited_at = now() WHERE id = ${id}`)
}

// A replaced tree moves both stamps in one write — the revision remounts an open editor, and
// „ostatnio edytowany" moves with it.
export async function markTemplateTreeReplaced(db: DbExecutorT, id: number): Promise<void> {
  await db.execute(sql`
    UPDATE templates SET updated_at = now(), content_edited_at = now() WHERE id = ${id}
  `)
}

// Every szablon (trashed included) holding a katalog entry — its delete cascades their prace out.
// Runs before the delete, while the rows naming the entry still exist.
export async function markTemplatesHoldingCatalogueItemReplaced(
  db: DbExecutorT,
  catalogueItemId: number,
): Promise<void> {
  await db.execute(sql`
    UPDATE templates SET updated_at = now(), content_edited_at = now()
    WHERE id IN (
      SELECT s.template_id FROM template_items i
      JOIN template_sections s ON s.id = i.section_id
      WHERE i.catalogue_item_id = ${catalogueItemId}
    )
  `)
}

/** The editor's revision token; other windows compare against it to notice a replaced tree. */
export async function bumpTemplateRevision(db: DbExecutorT, id: number): Promise<string> {
  const res = await db.execute(sql`
    UPDATE templates SET updated_at = now() WHERE id = ${id} RETURNING updated_at
  `)
  return new Date(res.rows[0]?.updated_at as string).toISOString()
}

export async function readTemplateRevision(
  db: DbExecutorT,
  id: number,
): Promise<string | undefined> {
  const res = await db.execute(sql`SELECT updated_at FROM templates WHERE id = ${id}`)
  const value = res.rows[0]?.updated_at
  return value == null ? undefined : new Date(value as string).toISOString()
}

export async function listTemplates(db: DbExecutorT): Promise<TemplateMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, name, created_at, content_edited_at FROM templates
    WHERE trashed_at IS NULL
    -- Sorted by the last edit, because that is what moves: a szablon is created once and worked on
    -- for weeks.
    ORDER BY content_edited_at DESC NULLS LAST, created_at DESC, id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    createdAt: isoOrNull(row.created_at) ?? '',
    updatedAt: isoOrNull(row.content_edited_at),
  }))
}

// The picker's grouping needs one szablon's sections CONSECUTIVELY, hence the szablon keys lead the
// ORDER BY.
export async function listTemplateSections(db: DbExecutorT): Promise<TemplateSectionMetaT[]> {
  const res = await db.execute(sql`
    SELECT t.id AS template_id, t.name AS template_name, s.id AS section_id, s.name AS section_name,
           COUNT(i.id) AS item_count
    FROM templates t
    JOIN template_sections s ON s.template_id = t.id
    LEFT JOIN template_items i ON i.section_id = s.id
    WHERE t.trashed_at IS NULL
    GROUP BY t.id, s.id
    ORDER BY t.created_at DESC, t.id DESC, s.display_order, s.id
  `)
  return res.rows.map((row) => ({
    templateId: Number(row.template_id),
    templateName: String(row.template_name),
    sectionId: Number(row.section_id),
    sectionName: String(row.section_name),
    itemCount: Number(row.item_count),
  }))
}

// Section id → the live szablon that owns it.
export async function templateOwnersOfSections(
  db: DbExecutorT,
  sectionIds: readonly number[],
): Promise<Map<number, number>> {
  if (sectionIds.length === 0) return new Map()
  const res = await db.execute(sql`
    SELECT s.id, s.template_id FROM template_sections s
    JOIN templates t ON t.id = s.template_id
    WHERE t.trashed_at IS NULL AND s.id IN (${sqlList(sectionIds)})
  `)
  return new Map(res.rows.map((row) => [Number(row.id), Number(row.template_id)]))
}
