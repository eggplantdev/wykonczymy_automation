import { makePreventDelete } from '@/hooks/prevent-delete'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'

/**
 * Refuse to delete a file something still points at.
 *
 * Every `*_rels` FK into `media` is ON DELETE cascade, so without this the delete succeeds and
 * silently strips the file from every record holding it — the hazard `media.ts`'s own afterDelete
 * comment describes.
 *
 * Never fires on the `deleteUnreferencedMedia` path, which only reaches rows with zero references;
 * this guards `/admin` and any direct `payload.delete`.
 */
export const preventReferencedMediaDelete = makePreventDelete({
  probes: MEDIA_RELATIONS.map(({ collection, field, label }) => ({
    collection,
    where: (id: string | number) => mediaReferenceWhere(field, id),
    label,
  })),
  message: (blockers) =>
    `Nie można usunąć pliku — jest używany w innych miejscach (${blockers.join(', ')}). Najpierw odepnij go tam.`,
})
