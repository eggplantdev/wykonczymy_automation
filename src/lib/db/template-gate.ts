import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type TemplateGateKindT = 'template' | 'section' | 'item'

export type TemplateGateT = { templateId: number; isTrashed: boolean }

// One round trip from whichever id the action holds to the szablon it writes: the editor fans a
// write out per changed cell. `undefined` when the row is gone, which callers report as NOT_FOUND.
export async function templateGateFor(
  db: DbExecutorT,
  kind: TemplateGateKindT,
  id: number,
): Promise<TemplateGateT | undefined> {
  const res = await db.execute(
    kind === 'template'
      ? sql`SELECT t.id, t.trashed_at FROM templates t WHERE t.id = ${id}`
      : kind === 'section'
        ? sql`SELECT t.id, t.trashed_at FROM template_sections s
              JOIN templates t ON t.id = s.template_id WHERE s.id = ${id}`
        : sql`SELECT t.id, t.trashed_at FROM template_items i
              JOIN template_sections s ON s.id = i.section_id
              JOIN templates t ON t.id = s.template_id WHERE i.id = ${id}`,
  )
  const row = res.rows[0]
  if (!row) return undefined
  return { templateId: Number(row.id), isTrashed: row.trashed_at != null }
}
