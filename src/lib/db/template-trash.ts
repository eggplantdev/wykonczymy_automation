import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type TrashedTemplateRowT = { id: number; name: string; trashedAt: Date }

export async function fetchTrashedTemplates(db: DbExecutorT): Promise<TrashedTemplateRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT id, name, trashed_at FROM templates
    WHERE trashed_at IS NOT NULL
    ORDER BY trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    trashedAt: new Date(row.trashed_at as string),
  }))
}

export async function selectPurgeableTemplateIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM templates
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays})
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}

export async function readTemplateTrashState(
  db: DbExecutorT,
  templateId: number,
): Promise<{ name: string; isTrashed: boolean } | undefined> {
  const { rows } = await db.execute(sql`
    SELECT name, trashed_at FROM templates WHERE id = ${templateId}
  `)
  const row = rows[0]
  if (!row) return undefined
  return { name: String(row.name), isTrashed: row.trashed_at != null }
}

export async function setTemplateTrashed(
  db: DbExecutorT,
  templateId: number,
  isTrashed: boolean,
): Promise<void> {
  await db.execute(sql`
    UPDATE templates SET trashed_at = ${isTrashed ? sql`now()` : sql`NULL`}
    WHERE id = ${templateId}
  `)
}

// Sections, prace and versions go with it by FK cascade.
export async function deleteTrashedTemplateRow(
  db: DbExecutorT,
  templateId: number,
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    DELETE FROM templates WHERE id = ${templateId} AND trashed_at IS NOT NULL RETURNING id
  `)
  return rows.length > 0
}
