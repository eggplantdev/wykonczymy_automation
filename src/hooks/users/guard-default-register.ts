import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { User } from '@/payload-types'
import { getDb } from '@/lib/db/get-db'
import { trashedRegisterMessage } from '@/lib/db/cash-register-gate'
import { resolveId } from '@/lib/utils/resolve-id'

/**
 * A default kasa preselects every new booking, so one pointing into the trash would book there until
 * the transfers gate refused it. Only a CHANGED default is checked: trashing a kasa clears it as a
 * default in the same transaction, so an unchanged one is never trashed.
 */
export const guardDefaultRegister: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const next = data as Partial<User>
  if (!('defaultCashRegister' in next)) return data

  const target = resolveId(next.defaultCashRegister)
  const previous = resolveId((originalDoc as User | undefined)?.defaultCashRegister)
  if (target === undefined || target === previous) return data

  const message = await trashedRegisterMessage(await getDb(req.payload, req), [target])
  if (message) throw new APIError(message, 403)
  return data
}
