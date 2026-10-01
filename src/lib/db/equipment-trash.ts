import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type TrashedEquipmentRowT = {
  id: number
  name: string
  make: string
  model: string
  serialNumber: string
  trashedAt: Date
}

export async function fetchTrashedEquipment(db: DbExecutorT): Promise<TrashedEquipmentRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT id, name, make, model, serial_number, trashed_at
    FROM equipment
    WHERE trashed_at IS NOT NULL
    ORDER BY trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    make: (row.make as string | null) ?? '',
    model: (row.model as string | null) ?? '',
    serialNumber: (row.serial_number as string | null) ?? '',
    trashedAt: new Date(row.trashed_at as string),
  }))
}

export async function selectPurgeableEquipmentIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM equipment
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays})
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}
