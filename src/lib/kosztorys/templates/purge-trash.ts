import 'server-only'
import { TEMPLATE_TRASH_TAGS } from '@/lib/cache/tags'
import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import { purgeTrashedRows } from '@/lib/cron/purge-trashed-rows'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectPurgeableTemplateIds } from '@/lib/db/template-trash'
import { deleteTrashedTemplate } from './delete-template-forever'

export async function purgeTemplateTrash(db: DbExecutorT) {
  return purgeTrashedRows({
    ids: await selectPurgeableTemplateIds(db, ENTITY_TRASH_RETENTION_DAYS),
    deleteForever: (id) => deleteTrashedTemplate(db, id),
    logPrefix: 'purgeTemplateTrash szablon',
    tags: TEMPLATE_TRASH_TAGS,
  })
}
