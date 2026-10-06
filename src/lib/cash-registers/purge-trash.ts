import 'server-only'
import type { Payload } from 'payload'
import { CASH_REGISTER_DELETE_TAGS } from '@/lib/cache/tags'
import { deleteTrashedCashRegister } from '@/lib/cash-registers/delete-cash-register-forever'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import { selectPurgeableCashRegisterIds } from '@/lib/db/cash-register-trash'
import type { DbExecutorT } from '@/lib/db/get-db'

export async function purgeCashRegisterTrash(payload: Payload, db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableCashRegisterIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => deleteTrashedCashRegister(payload, id),
    logPrefix: 'purgeCashRegisterTrash kasa',
    tags: CASH_REGISTER_DELETE_TAGS,
  })
}
