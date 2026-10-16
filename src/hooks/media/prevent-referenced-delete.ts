import { makePreventDelete } from '@/hooks/prevent-delete'
import { countDraftsHoldingMedia } from '@/lib/db/worker-expense-drafts'
import { countReportsHoldingMedia } from '@/lib/db/worker-reports'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'

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
    { label: 'zgłoszenia wydatków', count: (db, id) => countDraftsHoldingMedia(db, Number(id)) },
    { label: 'zgłoszenia prac', count: (db, id) => countReportsHoldingMedia(db, Number(id)) },
  ],
  message: (blockers) =>
    `Nie można usunąć pliku — jest używany w innych miejscach (${blockers.join(', ')}). Najpierw odepnij go tam.`,
})
