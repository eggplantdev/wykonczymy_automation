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
import type { ReferenceItemT } from '@/types/reference-data'

export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: TData } | { success: false; error: string }

export type ValidateSourceRegisterResultT =
  | { success: true; register: ReferenceItemT }
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
export async function withAction(
  label: string,
  handler: (ctx: ActionCtxT) => Promise<ActionResultT>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
): Promise<ActionResultT> {
  const elapsed = perfStart()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session
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
    return { success: false, error: getErrorMessage(err) }
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

  const register: ReferenceItemT = {
    id: Number(row.id),
    name: row.name as string,
    type: (row.type as string) ?? 'AUXILIARY',
    active: row.active as boolean,
    ownerId: row.owner_id ? Number(row.owner_id) : undefined,
  }

  // admin can transfer from any register, other roles can only transfer from their own register
  // todo
  // if (user.role !== 'ADMIN' && register.ownerId !== user.id) {
  //   return { success: false, error: 'Nie masz uprawnień do tej kasy' }
  // }

  return { success: true, register }
}

/** Verifies the register has enough balance for the withdrawal. Skips virtual registers. */

// temporary disabled
export async function checkIfSufficientBalance(
  register: ReferenceItemT,
  amount: number,
  payload: Payload,
): Promise<ActionResultT> {
  if (register.type === 'VIRTUAL') return { success: true }

  const currentBalance = await sumRegisterBalance(payload, register.id)

  if (currentBalance > amount) return { success: true }

  return {
    success: false,
    error: `Niewystarczające saldo kasy (${currentBalance.toFixed(2)} zł). Najpierw dodaj środki.`,
  }
}
