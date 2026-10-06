import 'server-only'
import type { Payload } from 'payload'
import { INVESTMENT_DELETE_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableInvestmentIds } from '@/lib/db/investment-trash'
import { deleteTrashedInvestment } from '@/lib/investments/delete-investment-forever'

export async function purgeTrash(payload: Payload, db: DbExecutorT) {
  const { purgeable, skippedKosztorys } = await selectPurgeableInvestmentIds(
    db,
    ENTITY_TRASH_RETENTION_DAYS,
  )
  const tally = await purgeTrashedRows({
    ids: purgeable,
    deleteForever: (id) => deleteTrashedInvestment(payload, id),
    logPrefix: 'purgeTrash investment',
    tags: INVESTMENT_DELETE_TAGS,
    entity: 'investment',
  })

  // Past retention but with a used kosztorys — only the owner can delete those, by name.
  return { ...tally, skippedKosztorys }
}
