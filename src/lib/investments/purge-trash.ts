import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW, entityTag, INVESTMENT_DELETE_TAGS } from '@/lib/cache/tags'
import type { DbExecutorT } from '@/lib/db/get-db'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import { selectPurgeableInvestmentIds } from '@/lib/db/investment-trash'
import { deleteTrashedInvestment } from '@/lib/investments/delete-investment-forever'

type PurgeTrashResultT = {
  purged: number
  /** Past retention but with a used kosztorys — only the owner can delete those, by name. */
  skippedKosztorys: number
  blocked: number
  failed: number
}

export async function purgeTrash(payload: Payload, db: DbExecutorT): Promise<PurgeTrashResultT> {
  const { purgeable, skippedKosztorys } = await selectPurgeableInvestmentIds(
    db,
    ENTITY_TRASH_RETENTION_DAYS,
  )
  const { purgedIds, blocked, failed } = await purgeTrashedRows(
    purgeable,
    (id) => deleteTrashedInvestment(payload, id),
    'purgeTrash investment',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of INVESTMENT_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
    for (const id of purgedIds) revalidateTag(entityTag('investment', id), EXPIRE_NOW)
  }

  return { purged: purgedIds.length, skippedKosztorys, blocked, failed }
}
