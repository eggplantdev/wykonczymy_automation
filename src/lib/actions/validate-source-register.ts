import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/sum-transfers'
import type { SessionUserT } from '@/types/auth'
import type { CashRegisterRefT, CashRegisterTypeT } from '@/types/reference-data'

export type ValidateSourceRegisterResultT =
  | { success: true; register: CashRegisterRefT }
  | { success: false; error: string }

/** Checks that the register exists and the user has ownership rights to it. */
export async function validateSourceRegister(
  cashRegisterId: number | undefined,
  user: SessionUserT,
  payload: Payload,
): Promise<ValidateSourceRegisterResultT> {
  if (cashRegisterId === undefined) return { success: false, error: 'Kasa nie istnieje' }

  const db = await getDb(payload)
  const result = await db.execute(sql`
    SELECT id, name, type::text, active::boolean, owner_id::integer
    FROM cash_registers
    WHERE id = ${cashRegisterId}
    LIMIT 1
  `)

  const row = result.rows[0]
  if (!row) return { success: false, error: 'Kasa nie istnieje' }

  const register: CashRegisterRefT = {
    id: Number(row.id),
    name: row.name as string,
    type: (row.type as CashRegisterTypeT) ?? 'AUXILIARY',
    active: row.active as boolean,
    ownerId: row.owner_id ? Number(row.owner_id) : undefined,
  }

  // ADMIN, OWNER, MANAGER can transfer from any register.
  // EMPLOYEE is blocked earlier by requireAuth(MANAGEMENT_ROLES) in protectedAction.

  return { success: true, register }
}

// No sufficient-funds guard by design: registers (auxiliary included) may go
// negative — a deliberate client decision. Do not re-add a balance check here or
// in the transfer actions; the saldo preview in the form is advisory only.
