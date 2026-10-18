import type { CollectionSlug, Where } from 'payload'

export type MediaRelationT = {
  collection: CollectionSlug
  field: string
  label: string
  relsTable: string
}

export const MEDIA_RELATIONS: readonly MediaRelationT[] = [
  {
    collection: 'transactions',
    field: 'invoice',
    label: 'transakcje',
    relsTable: 'transactions_rels',
  },
  {
    collection: 'vehicle-inspections',
    field: 'attachments',
    label: 'przeglądy',
    relsTable: 'vehicle_inspections_rels',
  },
  {
    collection: 'equipment-events',
    field: 'attachments',
    label: 'przekazania sprzętu',
    relsTable: 'equipment_events_rels',
  },
  {
    collection: 'investments',
    field: 'assets',
    label: 'inwestycje',
    relsTable: 'investments_rels',
  },
  { collection: 'leads', field: 'assets', label: 'zgłoszenia', relsTable: 'leads_rels' },
]

export const RAW_MEDIA_HOLDERS = [
  { table: 'worker_expense_draft_media', label: 'zgłoszenia wydatków' },
  { table: 'worker_report_media', label: 'zgłoszenia prac' },
] as const

// A table missing here reads as unattached, and the nightly sweep deletes its files.
export const MEDIA_HOLDER_TABLES = [
  ...MEDIA_RELATIONS.map(({ relsTable }) => relsTable),
  ...RAW_MEDIA_HOLDERS.map(({ table }) => table),
]

export function mediaReferenceWhere(
  field: string,
  ids: string | number | readonly (string | number)[],
): Where {
  return { [field]: Array.isArray(ids) ? { in: ids } : { equals: ids } }
}
