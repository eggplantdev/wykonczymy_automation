import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { RoleT } from '@/lib/auth/roles'

export type TrashedWorkerRowT = {
  id: number
  name: string
  role: RoleT
  trashedAt: Date
  registerNames: string[]
}

export async function fetchTrashedWorkers(db: DbExecutorT): Promise<TrashedWorkerRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT u.id, u.name, u.role::text AS role, u.trashed_at,
      COALESCE(
        (SELECT array_agg(c.name ORDER BY c.name) FROM cash_registers c WHERE c.owner_id = u.id),
        '{}'
      ) AS register_names
    FROM users u
    WHERE u.trashed_at IS NOT NULL
    ORDER BY u.trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    role: row.role as RoleT,
    trashedAt: new Date(row.trashed_at as string),
    registerNames: (row.register_names as string[]).map(String),
  }))
}

export async function selectPurgeableWorkerIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM users
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays})
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}

const ownedIds = async (db: DbExecutorT, query: unknown) =>
  (await db.execute(query)).rows.map((row) => Number(row.id))

export const selectLiveRegisterIds = (db: DbExecutorT, ownerId: number) =>
  ownedIds(
    db,
    sql`
    SELECT id FROM cash_registers WHERE owner_id = ${ownerId} AND trashed_at IS NULL ORDER BY id
  `,
  )

/** Read before the owner's own restore clears the stamp they share. */
export const selectRegistersTrashedWithOwner = (db: DbExecutorT, ownerId: number) =>
  ownedIds(
    db,
    sql`
    SELECT c.id FROM cash_registers c JOIN users u ON u.id = c.owner_id
    WHERE c.owner_id = ${ownerId} AND c.trashed_at = u.trashed_at ORDER BY c.id
  `,
  )

export const selectTrashedRegisterIds = (db: DbExecutorT, ownerId: number) =>
  ownedIds(
    db,
    sql`
    SELECT id FROM cash_registers WHERE owner_id = ${ownerId} AND trashed_at IS NOT NULL ORDER BY id
  `,
  )
