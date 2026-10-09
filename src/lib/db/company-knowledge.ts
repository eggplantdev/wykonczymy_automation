import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

export async function listCompanyKnowledge(db: DbExecutorT): Promise<CompanyKnowledgeEntryT[]> {
  const result = await db.execute(sql`
    SELECT id, topic, content, updated_at
    FROM company_knowledge
    ORDER BY display_order, id
  `)
  return result.rows.map((row) => ({
    id: Number(row.id),
    topic: String(row.topic),
    content: String(row.content),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
  }))
}

/** A new entry goes above every other one, so the one just written is in view. */
export async function nextTopDisplayOrder(db: DbExecutorT): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(MIN(display_order), 0) - 1 AS next FROM company_knowledge
  `)
  return Number(result.rows[0].next)
}

// Writes `display_order` only: „Ostatnio zmienione” sorts on `updated_at`, and a drag that bumped it
// would make every entry look freshly edited. Ids nobody sent keep their place, so an entry another
// manager added meanwhile is not lost from the order.
export async function applyCompanyKnowledgeOrder(
  db: DbExecutorT,
  ids: readonly number[],
): Promise<void> {
  const values = sql.join(
    ids.map((id, index) => sql`(${id}::int, ${index}::int)`),
    sql.raw(', '),
  )
  await db.execute(sql`
    UPDATE company_knowledge AS k
    SET display_order = v.ord
    FROM (VALUES ${values}) AS v(id, ord)
    WHERE k.id = v.id
  `)
}
