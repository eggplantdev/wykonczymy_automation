import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

// The suffix keeps `templates_name_idx` from colliding with a szablon from the dump or a parallel
// spec. Teardown is `deleteTestTemplate` — the cascade takes the tree and its versions.
export async function createTestTemplate(payload: Payload, name = 'Test szablon'): Promise<number> {
  const db = await getDb(payload)
  const res = await db.execute(sql`
    INSERT INTO templates (name, content_edited_at)
    VALUES (${`${name} ${crypto.randomUUID().slice(0, 8)}`}, now())
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

export async function deleteTestTemplate(payload: Payload, id: number): Promise<void> {
  const db = await getDb(payload)
  await db.execute(sql`DELETE FROM templates WHERE id = ${id}`)
}

// A szablon praca is a katalog entry, so a spec's prace start life in the katalog. The suffix keeps
// the entry's match key unique against the dump; teardown is `deleteTestCatalogueEntries`.
export async function createTestCatalogueEntry(
  payload: Payload,
  description: string,
  overrides: { unit?: string; clientPrice?: number; wToolsRate?: number | null } = {},
): Promise<number> {
  const unit = overrides.unit ?? 'm2'
  const unique = `${description} ${crypto.randomUUID().slice(0, 8)}`
  const entry = await payload.create({
    collection: 'work-catalogue-items',
    data: {
      description: unique,
      unit,
      clientPrice: overrides.clientPrice ?? 100,
      wToolsRate: overrides.wToolsRate ?? null,
      matchKey: catalogueKey(unique, unit),
    },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(entry.id)
}

export async function deleteTestCatalogueEntries(payload: Payload, ids: number[]): Promise<void> {
  for (const id of ids) {
    await payload
      .delete({
        collection: 'work-catalogue-items',
        id,
        overrideAccess: true,
        context: { skipRevalidation: true },
      })
      .catch(() => undefined)
  }
}

export async function addTestTemplateSection(
  payload: Payload,
  templateId: number,
  name: string,
  catalogueItemIds: number[],
  { displayOrder = 0, color = null }: { displayOrder?: number; color?: string | null } = {},
): Promise<{ sectionId: number; itemIds: number[] }> {
  const db = await getDb(payload)
  const section = await db.execute(sql`
    INSERT INTO template_sections (template_id, name, display_order, color)
    VALUES (${templateId}, ${name}, ${displayOrder}, ${color})
    RETURNING id
  `)
  const sectionId = Number(section.rows[0].id)
  const itemIds: number[] = []
  for (const [index, catalogueItemId] of catalogueItemIds.entries()) {
    const item = await db.execute(sql`
      INSERT INTO template_items (section_id, catalogue_item_id, display_order)
      VALUES (${sectionId}, ${catalogueItemId}, ${index})
      RETURNING id
    `)
    itemIds.push(Number(item.rows[0].id))
  }
  return { sectionId, itemIds }
}
