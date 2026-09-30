import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { clearDefaultRegister } from '@/lib/db/cash-register-trash'
import { getDb } from '@/lib/db/get-db'

/**
 * Takes the caller's `req` so a worker's trash (EX-918) can put the kasa and the worker in one
 * transaction.
 *
 * Refused on exactly what a hard delete refuses on, so nothing sits in the trash that could never
 * leave it. The default is cleared rather than kept: a picker that no longer offers the kasa would
 * otherwise preselect an id it cannot render.
 */
export async function trashCashRegister(
  payload: Payload,
  registerId: number,
  req: PayloadRequest,
): Promise<string | undefined> {
  const refusal = await cashRegisterDeleteBlocker(payload, registerId, req)
  if (refusal) return refusal

  await clearDefaultRegister(await getDb(payload, req), registerId)
  await payload.update({
    collection: 'cash-registers',
    id: registerId,
    data: { trashedAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
  return undefined
}
