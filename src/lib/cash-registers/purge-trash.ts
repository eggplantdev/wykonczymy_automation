import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, CASH_REGISTER_DELETE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { deleteTrashedCashRegister } from '@/lib/cash-registers/delete-cash-register-forever'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { selectPurgeableCashRegisterIds } from '@/lib/db/cash-register-trash'
import type { DbExecutorT } from '@/lib/db/get-db'

export type PurgeCashRegisterTrashResultT = {
  purged: number
  /** Pinned by a transaction booked after trashing; the write gate should make this 0. */
  blocked: number
  failed: number
}

// One kasa at a time, so one refusal or failure never strands the rest of the trash.
export async function purgeCashRegisterTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeCashRegisterTrashResultT> {
  const ids = await selectPurgeableCashRegisterIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const result = { purged: 0, blocked: 0, failed: 0 }

  for (const id of ids) {
    const outcome = await deleteTrashedCashRegister(payload, id)
    if (outcome.ok) {
      result.purged++
    } else if (outcome.reason === 'blocked') {
      result.blocked++
      // TODO(EX-449) SENTRY-REQUIRED: a trashed kasa took a transaction past the write gate.
      console.error(`[purgeCashRegisterTrash] kasa ${id} blocked: ${outcome.message}`)
    } else if (outcome.reason === 'error') {
      result.failed++
      // TODO(EX-449) SENTRY-REQUIRED: the kasa stays in the trash and is retried tomorrow.
      console.error(`[purgeCashRegisterTrash] kasa ${id} failed: ${outcome.message}`)
    }
  }

  // Route Handler context — `updateTag` throws here.
  if (result.purged > 0) {
    for (const key of CASH_REGISTER_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return result
}
