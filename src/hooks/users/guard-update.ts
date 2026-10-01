import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { User } from '@/payload-types'
import { WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'

/**
 * A trashed account is read-only apart from its restore. Payload's own login, lockout and session
 * writes go through `payload.db` and never reach this hook — refusing the login is `beforeLogin`'s job.
 */
export const guardUserUpdate: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  const original = originalDoc as User | undefined
  if (operation !== 'update' || !original?.trashedAt) return data

  const next = data as Partial<User>
  const trashedAt = 'trashedAt' in next ? next.trashedAt : original.trashedAt
  if (trashedAt) throw new APIError(WORKER_TRASHED_MESSAGE, 403)
  return data
}
