import 'server-only'
import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

// The whole sheet's order in one value: sections top to bottom, each with its items top to bottom.
// An item's section is wherever it is listed, so a move across sections is the same write as one
// within a section.
export const kosztorysLayoutSchema = z
  .array(z.object({ sectionId: z.number().int(), itemIds: z.array(z.number().int()) }))
  .min(1)

export type KosztorysLayoutT = z.infer<typeof kosztorysLayoutSchema>

export const LAYOUT_STALE = 'Układ się zmienił w międzyczasie — odśwież i spróbuj ponownie.'

// Refuses anything but a permutation of the sheet as it stands under the lock: a row added or
// deleted in another tab would otherwise be silently dropped from, or smuggled into, the order.
// Ascending id like every other acquisition in display-order.ts (EX-632). Split from the write so
// the caller can take its auto snapshot in between — a refused layout must leave no version.
export async function lockAndCheckLayout(
  db: DbExecutorT,
  investmentId: number,
  layout: KosztorysLayoutT,
): Promise<boolean> {
  const sectionRes = await db.execute(sql`
    SELECT id FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY id FOR UPDATE
  `)
  const itemRes = await db.execute(sql`
    SELECT id FROM kosztorys_items WHERE investment_id = ${investmentId} ORDER BY id FOR UPDATE
  `)
  const sectionIds = new Set(sectionRes.rows.map((row) => Number(row.id)))
  const itemIds = new Set(itemRes.rows.map((row) => Number(row.id)))
  const sentItems = layout.flatMap((section) => section.itemIds)
  const sentSections = layout.map((section) => section.sectionId)
  const isPermutation = (sent: number[], owned: Set<number>) =>
    sent.length === owned.size &&
    new Set(sent).size === sent.length &&
    sent.every((id) => owned.has(id))
  return isPermutation(sentSections, sectionIds) && isPermutation(sentItems, itemIds)
}

export async function applyLayout(
  db: DbExecutorT,
  investmentId: number,
  layout: KosztorysLayoutT,
): Promise<void> {
  const sectionValues = sql.join(
    layout.map((section, index) => sql`(${section.sectionId}::int, ${index}::int)`),
    sql.raw(', '),
  )
  await db.execute(sql`
    UPDATE kosztorys_sections AS s
    SET display_order = v.ord, updated_at = now()
    FROM (VALUES ${sectionValues}) AS v(id, ord)
    WHERE s.id = v.id AND s.investment_id = ${investmentId}
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
    await db.execute(sql`
      UPDATE kosztorys_items AS i
      SET section_id = v.section_id, display_order = v.ord, updated_at = now()
      FROM (VALUES ${itemValues}) AS v(id, section_id, ord)
      WHERE i.id = v.id AND i.investment_id = ${investmentId}
    `)
  }

  // The editor reseeds its grid off the investment's revision token (see setItemTexts).
  await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
}
