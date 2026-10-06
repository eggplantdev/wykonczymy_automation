import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { bumpInvestmentRevision } from '@/lib/db/investment-revision'
import type { KosztorysLayoutT } from '@/lib/kosztorys/reorder-layout'

// Refuses anything but a permutation of the sheet as it stands under the lock: a row added or
// deleted in another tab would otherwise be silently dropped from, or smuggled into, the order.
// Split from the write so the caller can take its auto snapshot in between — a refused layout must
// leave no version.
//
// Lock order, against the writers it can meet: the investment first, in KEY SHARE, queues this
// behind a tree replacement or a report acceptance (both take it FOR UPDATE before any row) and
// still lets a cell save bump the revision. Rows in NO KEY UPDATE, ascending id like display-order.ts
// (EX-632): FOR UPDATE would also block the KEY SHARE an „Dodaj pracę” insert takes on its section
// while holding the items, and the two would deadlock.
export async function lockAndCheckLayout(
  db: DbExecutorT,
  investmentId: number,
  layout: KosztorysLayoutT,
): Promise<boolean> {
  await db.execute(sql`SELECT id FROM investments WHERE id = ${investmentId} FOR KEY SHARE`)
  const sectionRes = await db.execute(sql`
    SELECT id FROM kosztorys_sections WHERE investment_id = ${investmentId}
    ORDER BY id FOR NO KEY UPDATE
  `)
  const itemRes = await db.execute(sql`
    SELECT id FROM kosztorys_items WHERE investment_id = ${investmentId}
    ORDER BY id FOR NO KEY UPDATE
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

  await bumpInvestmentRevision(db, investmentId)
}
