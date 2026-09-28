import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW, entityTag, INVESTMENT_DELETE_TAGS } from '@/lib/cache/tags'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableInvestmentIds, TRASH_RETENTION_DAYS } from '@/lib/db/investment-trash'
import { deleteTrashedInvestment } from '@/lib/investments/delete-investment-forever'

export type PurgeTrashResultT = {
  purged: number
  /** Past retention but with a used kosztorys — only the owner can delete those, by name. */
  skippedKosztorys: number
  /** Pinned by a transaction booked after trashing; the write gate should make this 0. */
  blocked: number
  failed: number
}

// One investment at a time, so one refusal or failure never strands the rest of the trash.
export async function purgeTrash(payload: Payload, db: DbExecutorT): Promise<PurgeTrashResultT> {
  const { purgeable, skippedKosztorys } = await selectPurgeableInvestmentIds(
    db,
    TRASH_RETENTION_DAYS,
  )
  const result: PurgeTrashResultT = { purged: 0, skippedKosztorys, blocked: 0, failed: 0 }
  const purgedIds: number[] = []

  for (const id of purgeable) {
    const outcome = await deleteTrashedInvestment(payload, id)
    if (outcome.ok) {
      result.purged++
      purgedIds.push(id)
    } else if (outcome.reason === 'blocked') {
      result.blocked++
      // TODO(EX-449) SENTRY-REQUIRED: a trashed investment took a transaction past the write gate.
      console.error(`[purgeTrash] investment ${id} blocked: ${outcome.message}`)
    } else if (outcome.reason === 'error') {
      result.failed++
      // TODO(EX-449) SENTRY-REQUIRED: the row stays in the trash and is retried tomorrow.
      console.error(`[purgeTrash] investment ${id} failed: ${outcome.message}`)
    }
  }

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of INVESTMENT_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
    for (const id of purgedIds) revalidateTag(entityTag('investment', id), EXPIRE_NOW)
  }

  return result
}
