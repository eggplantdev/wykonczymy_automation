import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { makePreventDelete } from '@/hooks/prevent-delete'

// A warehouse that a handover already points at cannot be deleted. Unlike an expense category —
// whose FK is `ON DELETE SET NULL`, and whose absence still leaves a meaningful row — a warehouse is
// the TARGET of the handover: nulling it would leave a historical event pointing nowhere, breaking
// the „exactly one of three" invariant and reporting the item as „nie wiadomo gdzie".
const preventDeleteWithEvents = makePreventDelete({
  probes: [
    {
      collection: 'equipment-events',
      where: (id) => ({ warehouse: { equals: id } }),
      label: 'przekazania sprzętu',
    },
  ],
  message: (blockers) =>
    `Nie można usunąć magazynu — wskazują na niego zapisy w historii sprzętu (${blockers.join(', ')}).`,
})

/**
 * Where the company keeps things between jobs. A dictionary, not a screen: there are a handful of
 * them, they are added from /admin, and their contents are read as a filter on the equipment list.
 *
 * A warehouse is a first-class row while a workshop (`serviceProvider`) is free text, because these
 * few recur and are grouped by — a typo splits „Kwiatowa" into two filter entries and quietly halves
 * the answer — whereas a workshop appears once per repair and is never a criterion.
 */
export const Warehouses: CollectionConfig = {
  slug: 'warehouses',
  labels: {
    singular: { en: 'Warehouse', pl: 'Magazyn' },
    plural: { en: 'Warehouses', pl: 'Magazyny' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: { en: 'Equipment', pl: 'Sprzęt' },
  },
  hooks: {
    beforeDelete: [preventDeleteWithEvents],
    afterChange: [makeRevalidateAfterChange('warehouses')],
    afterDelete: [makeRevalidateAfterDelete('warehouses')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
  ],
}
