import type { ZodType, ZodError } from 'zod'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollections } from '@/lib/cache/revalidate'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import { sql } from '@payloadcms/db-vercel-postgres'
// import { getDb, sumRegisterBalance } from '@/lib/db/sum-transfers'
import { getDb, sumRegisterBalance } from '@/lib/db/sum-transfers'
import { perfStart } from '@/lib/perf'
import type { SessionUserT } from '@/types/auth'
import type { CashRegisterRefT, CashRegisterTypeT, ReferenceItemT } from '@/types/reference-data'

export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }

export type ValidateSourceRegisterResultT =
  | { success: true; register: CashRegisterRefT }
  | { success: false; error: string }

type ActionCtxT = { payload: Payload; user: SessionUserT }

const DEFAULT_ERROR = 'Wystąpił błąd'

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : DEFAULT_ERROR
}

const firstZodError = (error: ZodError): string => error.issues[0]?.message ?? DEFAULT_ERROR

export function validateAction<TData>(
  schema: ZodType<TData>,
  data: unknown,
): { success: true; data: TData } | { success: false; error: string } {
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { success: false, error: firstZodError(parsed.error) }
  return { success: true, data: parsed.data }
}

/** Auth + payload + try/catch + perf + revalidation wrapper for actions. */
export async function protectedAction<TData = undefined>(
  label: string,
  handler: (ctx: ActionCtxT) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
): Promise<ActionResultT<TData>> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return { success: false, error: session.error } as ActionResultT<TData>
  console.log(`[PERF]   requireAuth ${elapsed()}ms`)

  try {
    const payload = await getPayload({ config })
    console.log(`[PERF]   getPayload ${elapsed()}ms`)

    const result = await handler({ payload, user: session.user })
    console.log(`[PERF]   handler done ${elapsed()}ms`)

    if (result.success && revalidate) {
      revalidateCollections(revalidate)
      console.log(`[PERF]   revalidateCollections ${elapsed()}ms`)
    }

    console.log(`[PERF] ${label} ${elapsed()}ms`)
    return result
  } catch (err) {
    console.error(`[ACTION_ERROR] ${label}`, err)
    return { success: false, error: getErrorMessage(err) } as ActionResultT<TData>
  }
}

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

/* Verifies the register has enough balance for the withdrawal. Only applies to Auxiliary registers.
 * Workers sometimes pays from their own money - meaning negative balance. Virtual is designed to have negative balance most of the time.
 * Owner has main registers - he can do whatever he wants, so this applies only for auxiliary registers.
 */

export async function checkIfSufficientBalance(
  register: CashRegisterRefT,
  amount: number,
  payload: Payload,
): Promise<ActionResultT> {
  if (register.type !== 'AUXILIARY') return { success: true }
  const currentBalance = await sumRegisterBalance(payload, register.id)

  if (currentBalance >= amount) return { success: true }

  return {
    success: false,
    error: `Niewystarczające saldo kasy (${currentBalance.toFixed(2)} zł). Najpierw dodaj środki.`,
  }
}
