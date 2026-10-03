import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { clearDefaultRegister } from '@/lib/db/cash-register-trash'
import { getDb } from '@/lib/db/get-db'

/**
 * Takes the caller's `req` and instant so a worker's trash (EX-918) puts the kasa and the worker in
 * one transaction under one `trashedAt` — the stamp his restore finds his kasy by.
 *
 * Refused on exactly what a hard delete refuses on, so nothing sits in the trash that could never
 * leave it. The default is cleared rather than kept: a picker that no longer offers the kasa would
 * otherwise preselect an id it cannot render.
 */
export async function trashCashRegister(
  payload: Payload,
  registerId: number,
  req: PayloadRequest,
  trashedAt: string = new Date().toISOString(),
): Promise<string | undefined> {
  const refusal = await cashRegisterDeleteBlocker(payload, registerId, req)
  if (refusal) return refusal

  await clearDefaultRegister(await getDb(payload, req), registerId)
  await payload.update({
    collection: 'cash-registers',
    id: registerId,
    data: { trashedAt },
    overrideAccess: true,
    req,
  })
  return undefined
}
