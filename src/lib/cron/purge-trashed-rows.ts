import 'server-only'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS, entityTag, type EntityNameT, EXPIRE_NOW } from '@/lib/cache/tags'
import type { DeleteForeverResultT } from '@/types/trash'

type PurgeTrashedRowsOptsT = {
  ids: readonly number[]
  deleteForever: (id: number) => Promise<DeleteForeverResultT>
  logPrefix: string
  tags: readonly (keyof typeof CACHE_TAGS)[]
  /** Also expire `entityTag(entity, id)` for every purged row. */
  entity?: EntityNameT
}

type PurgeTallyT = {
  purged: number
  /** Pinned by a transaction booked after trashing; the write gate should make this 0. */
  blocked: number
  failed: number
}

// One row at a time, so one refusal or failure never strands the rest of the trash.
export async function purgeTrashedRows({
  ids,
  deleteForever,
  logPrefix,
  tags,
  entity,
}: PurgeTrashedRowsOptsT): Promise<PurgeTallyT> {
  const purgedIds: number[] = []
  let blocked = 0
  let failed = 0

  for (const id of ids) {
    const outcome = await deleteForever(id)
    if (outcome.ok) {
      purgedIds.push(id)
    } else if (outcome.reason === 'blocked') {
      blocked++
      // TODO(EX-449) SENTRY-REQUIRED: a trashed row took a transaction past the write gate.
      console.error(`[${logPrefix}] ${id} blocked: ${outcome.message}`)
    } else if (outcome.reason === 'error') {
      failed++
      // TODO(EX-449) SENTRY-REQUIRED: the row stays in the trash and is retried tomorrow.
      console.error(`[${logPrefix}] ${id} failed: ${outcome.message}`)
    }
  }

  // Cron runs in a Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of tags) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
    if (entity) for (const id of purgedIds) revalidateTag(entityTag(entity, id), EXPIRE_NOW)
  }

  return { purged: purgedIds.length, blocked, failed }
}
