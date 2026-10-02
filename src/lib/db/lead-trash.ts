import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { textOrNull } from '@/lib/db/row-coerce'
import { sqlList } from '@/lib/db/sql-list'
import type { Lead } from '@/payload-types'

export type TrashedLeadRowT = {
  id: number
  name: string | null
  email: string | null
  phone: string | null
  source: Lead['source']
  submittedAt: Date | null
  trashedAt: Date
}

// An erased lead is a tombstone kept only for the reconcile dedupe — it is no longer in the trash.
export async function fetchTrashedLeads(db: DbExecutorT): Promise<TrashedLeadRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT id, name, email, phone, source, submitted_at, trashed_at
    FROM leads
    WHERE trashed_at IS NOT NULL AND erased_at IS NULL
    ORDER BY trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: textOrNull(row.name),
    email: textOrNull(row.email),
    phone: textOrNull(row.phone),
    source: row.source as Lead['source'],
    submittedAt: row.submitted_at ? new Date(row.submitted_at as string) : null,
    trashedAt: new Date(row.trashed_at as string),
  }))
}

export async function selectPurgeableLeadIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM leads
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays})
      AND erased_at IS NULL
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}

/**
 * One statement for the whole selection rather than a Payload write per lead: the collection's only
 * hook is revalidation, which the action does once anyway. Already-trashed ids are skipped, so the
 * count is what actually moved.
 */
export async function trashLeads(db: DbExecutorT, ids: readonly number[]): Promise<number> {
  const { rows } = await db.execute(sql`
    UPDATE leads SET trashed_at = now(), updated_at = now()
    WHERE id IN (${sqlList(ids)}) AND trashed_at IS NULL
    RETURNING id
  `)
  return rows.length
}
