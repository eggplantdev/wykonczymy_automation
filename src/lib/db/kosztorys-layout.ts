import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { bumpInvestmentRevision } from '@/lib/db/investment-revision'
import { coversExactly, type KosztorysLayoutT } from '@/lib/kosztorys/reorder-layout'

// Rows in NO KEY UPDATE: FOR UPDATE would also block the KEY SHARE an „Dodaj pracę” insert takes on
// its section while holding the items, and the two would deadlock.
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
  return coversExactly(
    layout,
    new Set(sectionRes.rows.map((row) => Number(row.id))),
    new Set(itemRes.rows.map((row) => Number(row.id))),
  )
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
