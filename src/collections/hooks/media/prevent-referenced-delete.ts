import { makePreventDelete } from '@/collections/hooks/prevent-delete'
import type { DbExecutorT } from '@/lib/db/get-db'
import { countMediaHolders } from '@/lib/db/media-detachments'
import {
  MEDIA_RELATIONS,
  RAW_MEDIA_HOLDERS,
  mediaReferenceWhere,
} from '@/lib/media/relating-collections'

/**
 * Every `*_rels` FK into `media` is ON DELETE cascade, so without this the delete succeeds and
 * silently strips the file from every record holding it.
 */
export const preventReferencedMediaDelete = makePreventDelete({
  probes: [
    ...MEDIA_RELATIONS.map(({ collection, field, label }) => ({
      collection,
      where: (id: string | number) => mediaReferenceWhere(field, id),
      label,
    })),
    ...RAW_MEDIA_HOLDERS.map(({ table, label }) => ({
      label,
      count: (db: DbExecutorT, id: string | number) => countMediaHolders(db, table, Number(id)),
    })),
  ],
  message: (blockers) =>
    `Nie można usunąć pliku — jest używany w innych miejscach (${blockers.join(', ')}). Najpierw odepnij go tam.`,
})
