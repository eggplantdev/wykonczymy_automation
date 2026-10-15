import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { bumpTemplateRevision } from '@/lib/db/templates'
import type { DbExecutorT } from '@/lib/db/get-db'
import { isSectionColorKey, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysLayoutT } from '@/lib/kosztorys/reorder-layout'
import type { KosztorysSectionT } from '@/lib/kosztorys/types'

// The szablon plane's statements. Its tables are read-only to Payload, so every write is raw SQL;
// display order goes through the shared `display-order.ts` scopes, so the lock order (ascending id)
// is the same one the kosztorys plane uses.

export type TemplateSectionPatchT = {
  name?: string
  displayOrder?: number
  color?: SectionColorKeyT | null
}

export async function insertTemplateSection(
  db: DbExecutorT,
  templateId: number,
  name: string,
  displayOrder: number,
): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO template_sections (template_id, name, display_order)
    VALUES (${templateId}, ${name}, ${displayOrder})
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

export async function updateTemplateSection(
  db: DbExecutorT,
  sectionId: number,
  patch: TemplateSectionPatchT,
): Promise<void> {
  const sets = [
    patch.name !== undefined && sql`name = ${patch.name}`,
    patch.displayOrder !== undefined && sql`display_order = ${patch.displayOrder}`,
    patch.color !== undefined && sql`color = ${patch.color}`,
  ].filter((set) => set !== false)
  if (sets.length === 0) return
  await db.execute(sql`
    UPDATE template_sections SET ${sql.join(sets, sql.raw(', '))}, updated_at = now()
    WHERE id = ${sectionId}
  `)
}

export async function deleteTemplateSection(db: DbExecutorT, sectionId: number): Promise<void> {
  await db.execute(sql`DELETE FROM template_sections WHERE id = ${sectionId}`)
}

export async function deleteTemplateItem(db: DbExecutorT, itemId: number): Promise<void> {
  await db.execute(sql`DELETE FROM template_items WHERE id = ${itemId}`)
}

// The prace go with their sections (ON DELETE CASCADE).
export async function deleteTemplateSections(db: DbExecutorT, templateId: number): Promise<void> {
  await db.execute(sql`DELETE FROM template_sections WHERE template_id = ${templateId}`)
}

// Append slot = MAX+1, not COUNT: a removed praca leaves a gap a count would collide with.
export async function templateSectionAndNextItemOrder(
  db: DbExecutorT,
  sectionId: number,
): Promise<{ templateId: number; nextDisplayOrder: number; section: KosztorysSectionT } | undefined> {
  const res = await db.execute(sql`
    SELECT
      s.template_id, s.name, s.display_order, s.color,
      COALESCE(MAX(i.display_order) + 1, 0) AS next
    FROM template_sections s
    LEFT JOIN template_items i ON i.section_id = s.id
    WHERE s.id = ${sectionId}
    GROUP BY s.id
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return {
    templateId: Number(row.template_id),
    nextDisplayOrder: Number(row.next ?? 0),
    section: {
      id: sectionId,
      name: String(row.name),
      displayOrder: Number(row.display_order),
      color: isSectionColorKey(row.color) ? row.color : null,
    },
  }
}

// Same equality as the kosztorys plane's „Sekcja z katalogu": the name is the sekcja's identity.
export async function templateSectionIdByName(
  db: DbExecutorT,
  templateId: number,
  name: string,
): Promise<number | undefined> {
  const res = await db.execute(sql`
    SELECT id FROM template_sections
    WHERE template_id = ${templateId} AND lower(btrim(name)) = lower(btrim(${name}))
    ORDER BY display_order, id
    LIMIT 1
  `)
  const row = res.rows[0]
  return row ? Number(row.id) : undefined
}

// Ids come back in the order of `catalogueItemIds`, because each row's display_order is distinct.
export async function insertTemplateItems(
  db: DbExecutorT,
  sectionId: number,
  firstDisplayOrder: number,
  catalogueItemIds: readonly number[],
): Promise<number[]> {
  if (catalogueItemIds.length === 0) return []
  const values = sql.join(
    catalogueItemIds.map(
      (catalogueItemId, i) =>
        sql`(${sectionId}::int, ${catalogueItemId}::int, ${firstDisplayOrder + i}::int)`,
    ),
    sql.raw(', '),
  )
  const res = await db.execute(sql`
    INSERT INTO template_items (section_id, catalogue_item_id, display_order)
    VALUES ${values}
    RETURNING id, display_order
  `)
  const idByOrder = new Map(res.rows.map((row) => [Number(row.display_order), Number(row.id)]))
  return catalogueItemIds.map((_, i) => idByOrder.get(firstDisplayOrder + i) ?? 0)
}

// The whole szablon's prace under the lock „Zapisz kolejność" needs, ascending id like every other
// acquisition in display-order.ts.
export async function lockTemplateItemSections(
  db: DbExecutorT,
  templateId: number,
): Promise<Map<number, number>> {
  const res = await db.execute(sql`
    SELECT ti.id, ti.section_id FROM template_items ti
    WHERE ti.section_id IN (SELECT id FROM template_sections WHERE template_id = ${templateId})
    ORDER BY ti.id FOR UPDATE
  `)
  return new Map(res.rows.map((row) => [Number(row.id), Number(row.section_id)]))
}

export async function getTemplateSectionNames(
  db: DbExecutorT,
  templateId: number,
): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT name FROM template_sections
    WHERE template_id = ${templateId} AND trim(coalesce(name, '')) <> ''
  `)
  return res.rows.map((row) => String(row.name))
}

// The kosztorys plane's `lockAndCheckLayout`, on the szablon's tables: the szablon row in KEY SHARE,
// then its rows in NO KEY UPDATE by ascending id, and only a permutation of what stands is accepted.
export async function lockAndCheckTemplateLayout(
  db: DbExecutorT,
  templateId: number,
  layout: KosztorysLayoutT,
): Promise<boolean> {
  await db.execute(sql`SELECT id FROM templates WHERE id = ${templateId} FOR KEY SHARE`)
  const sectionRes = await db.execute(sql`
    SELECT id FROM template_sections WHERE template_id = ${templateId}
    ORDER BY id FOR NO KEY UPDATE
  `)
  const itemRes = await db.execute(sql`
    SELECT ti.id FROM template_items ti
    JOIN template_sections ts ON ts.id = ti.section_id
    WHERE ts.template_id = ${templateId}
    ORDER BY ti.id FOR NO KEY UPDATE OF ti
  `)
  const sectionIds = new Set(sectionRes.rows.map((row) => Number(row.id)))
  const itemIds = new Set(itemRes.rows.map((row) => Number(row.id)))
  const isPermutation = (sent: number[], owned: Set<number>) =>
    sent.length === owned.size &&
    new Set(sent).size === sent.length &&
    sent.every((id) => owned.has(id))
  return (
    isPermutation(
      layout.map((section) => section.sectionId),
      sectionIds,
    ) &&
    isPermutation(
      layout.flatMap((section) => section.itemIds),
      itemIds,
    )
  )
}

export async function applyTemplateLayout(
  db: DbExecutorT,
  templateId: number,
  layout: KosztorysLayoutT,
): Promise<void> {
  const sectionValues = sql.join(
    layout.map((section, index) => sql`(${section.sectionId}::int, ${index}::int)`),
    sql.raw(', '),
  )
  await db.execute(sql`
    UPDATE template_sections AS s
    SET display_order = v.ord, updated_at = now()
    FROM (VALUES ${sectionValues}) AS v(id, ord)
    WHERE s.id = v.id AND s.template_id = ${templateId}
  `)

  if (layout.some((section) => section.itemIds.length > 0)) {
    const itemValues = sql.join(
      layout.flatMap((section) =>
        section.itemIds.map(
          (id, index) => sql`(${id}::int, ${section.sectionId}::int, ${index}::int)`,
        ),
      ),
      sql.raw(', '),
    )
    // Target sections were checked to be this szablon's by the permutation test under the lock.
    await db.execute(sql`
      UPDATE template_items AS i
      SET section_id = v.section_id, display_order = v.ord, updated_at = now()
      FROM (VALUES ${itemValues}) AS v(id, section_id, ord)
      WHERE i.id = v.id
    `)
  }

  await bumpTemplateRevision(db, templateId)
}
