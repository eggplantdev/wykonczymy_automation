import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { clearDefaultRegister } from '@/lib/db/cash-register-trash'
import { getDb } from '@/lib/db/get-db'

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
