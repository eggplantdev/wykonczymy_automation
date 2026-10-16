import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { makePreventDelete } from '@/hooks/prevent-delete'

// nulling it would leave a historical event pointing nowhere, breaking the „exactly one of three"
// invariant
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
