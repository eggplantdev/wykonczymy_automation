import type { CollectionSlug, Where } from 'payload'

export type MediaRelationT = {
  collection: CollectionSlug
  field: string
  label: string
}

export const MEDIA_RELATIONS: readonly MediaRelationT[] = [
  { collection: 'transactions', field: 'invoice', label: 'transakcje' },
  { collection: 'vehicle-inspections', field: 'attachments', label: 'przeglądy' },
  { collection: 'equipment-events', field: 'attachments', label: 'przekazania sprzętu' },
  { collection: 'investments', field: 'assets', label: 'inwestycje' },
  { collection: 'leads', field: 'assets', label: 'zgłoszenia' },
]

export function mediaReferenceWhere(
  field: string,
  ids: string | number | readonly (string | number)[],
): Where {
  return { [field]: Array.isArray(ids) ? { in: ids } : { equals: ids } }
}
