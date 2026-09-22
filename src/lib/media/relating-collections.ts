import type { CollectionSlug, Where } from 'payload'

export type MediaRelationT = {
  collection: CollectionSlug
  /** The field on `collection` that points at `media`. */
  field: string
  /** Polish noun the delete refusal interpolates, e.g. „transakcje: 5". */
  label: string
}

/**
 * Every collection+field that points at `media`, in one place.
 *
 * Both readers derive from this list: the delete guard on `media` and `deleteUnreferencedMedia`'s
 * reference count. They used to be two hand-maintained lists and drifted — `equipment-events.attachments`
 * was added to the schema and to neither, so its files were deletable out from under a live record.
 * A new relation is one line here and both readers pick it up.
 */
export const MEDIA_RELATIONS: readonly MediaRelationT[] = [
  { collection: 'transactions', field: 'invoice', label: 'transakcje' },
  { collection: 'vehicle-inspections', field: 'attachments', label: 'przeglądy' },
  { collection: 'equipment-events', field: 'attachments', label: 'przekazania sprzętu' },
  { collection: 'investments', field: 'assets', label: 'inwestycje' },
  { collection: 'leads', field: 'assets', label: 'zgłoszenia' },
]

/**
 * One `Where` for both shapes: a single id when the caller asks about one file, `in` when it scans a
 * whole batch at once. `deleteUnreferencedMedia` needs the batch form to keep its scan at one query
 * per relation instead of one per relation per id.
 */
export function mediaReferenceWhere(
  field: string,
  ids: string | number | readonly (string | number)[],
): Where {
  return { [field]: Array.isArray(ids) ? { in: ids } : { equals: ids } }
}
