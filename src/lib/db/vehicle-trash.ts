import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type TrashedVehicleRowT = {
  id: number
  registration: string
  make: string
  model: string
  trashedAt: Date
}

export async function fetchTrashedVehicles(db: DbExecutorT): Promise<TrashedVehicleRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT id, registration, make, model, trashed_at
    FROM vehicles
    WHERE trashed_at IS NOT NULL
    ORDER BY trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    registration: String(row.registration),
    make: String(row.make),
    model: String(row.model),
    trashedAt: new Date(row.trashed_at as string),
  }))
}

export async function selectPurgeableVehicleIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM vehicles
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays})
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}
