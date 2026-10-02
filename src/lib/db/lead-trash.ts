import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
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

const asNullableString = (value: unknown) => (typeof value === 'string' ? value : null)

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
    name: asNullableString(row.name),
    email: asNullableString(row.email),
    phone: asNullableString(row.phone),
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
