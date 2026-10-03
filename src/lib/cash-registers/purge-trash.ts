import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, CASH_REGISTER_DELETE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { deleteTrashedCashRegister } from '@/lib/cash-registers/delete-cash-register-forever'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import { selectPurgeableCashRegisterIds } from '@/lib/db/cash-register-trash'
import type { DbExecutorT } from '@/lib/db/get-db'

type PurgeCashRegisterTrashResultT = {
  purged: number
  blocked: number
  failed: number
}

export async function purgeCashRegisterTrash(
  payload: Payload,
  db: DbExecutorT,
): Promise<PurgeCashRegisterTrashResultT> {
  const ids = await selectPurgeableCashRegisterIds(db, ENTITY_TRASH_RETENTION_DAYS)
  const { purgedIds, blocked, failed } = await purgeTrashedRows(
    ids,
    (id) => deleteTrashedCashRegister(payload, id),
    'purgeCashRegisterTrash kasa',
  )

  // Route Handler context — `updateTag` throws here.
  if (purgedIds.length > 0) {
    for (const key of CASH_REGISTER_DELETE_TAGS) revalidateTag(CACHE_TAGS[key], EXPIRE_NOW)
  }

  return { purged: purgedIds.length, blocked, failed }
}
