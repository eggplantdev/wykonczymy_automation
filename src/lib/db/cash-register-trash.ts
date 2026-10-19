import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { RoleT } from '@/lib/auth/roles'
import type { CashRegisterTypeT } from '@/types/reference-data'

export type TrashedCashRegisterRowT = {
  id: number
  name: string
  type: CashRegisterTypeT
  ownerId?: number
  ownerRole?: RoleT
  trashedAt: Date
}

// A kasa whose owner is in the trash went there WITH him: it is listed, restored and purged as part of
// the worker, never on its own.
const OWNER_LIVE = sql`NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = cash_registers.owner_id AND u.trashed_at IS NOT NULL
)`

export async function fetchTrashedCashRegisters(
  db: DbExecutorT,
): Promise<TrashedCashRegisterRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT id, name, type, trashed_at, owner_id,
      (SELECT role FROM users WHERE users.id = cash_registers.owner_id) AS owner_role
    FROM cash_registers
    WHERE trashed_at IS NOT NULL AND ${OWNER_LIVE}
    ORDER BY trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    type: row.type as CashRegisterTypeT,
    ownerId: row.owner_id ? Number(row.owner_id) : undefined,
    ownerRole: (row.owner_role as RoleT | null) ?? undefined,
    trashedAt: new Date(row.trashed_at as string),
  }))
}

export async function selectPurgeableCashRegisterIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<number[]> {
  const { rows } = await db.execute(sql`
    SELECT id FROM cash_registers
    WHERE trashed_at < now() - make_interval(days => ${olderThanDays}) AND ${OWNER_LIVE}
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}

// Raw SQL because a Payload update per user would run the users hooks and their revalidation once
// per row — the caller expires `users` itself.
export async function clearDefaultRegister(db: DbExecutorT, registerId: number): Promise<void> {
  await db.execute(sql`
    UPDATE users SET default_cash_register_id = NULL WHERE default_cash_register_id = ${registerId}
  `)
}
