import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { validateEquipmentEvent } from '@/hooks/equipment/validate'

export const EquipmentEvents: CollectionConfig = {
  slug: 'equipment-events',
  labels: {
    singular: { en: 'Equipment event', pl: 'Przekazanie sprzętu' },
    plural: { en: 'Equipment events', pl: 'Historia sprzętu' },
  },
  admin: {
    useAsTitle: 'occurredAt',
    defaultColumns: ['equipment', 'occurredAt', 'holder', 'warehouse', 'serviceProvider'],
    group: { en: 'Equipment', pl: 'Sprzęt' },
  },
  hooks: {
    beforeValidate: [validateEquipmentEvent],
    afterChange: [makeRevalidateAfterChange('equipmentEvents')],
    afterDelete: [makeRevalidateAfterDelete('equipmentEvents')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'equipment',
      type: 'relationship',
      relationTo: 'equipment',
      required: true,
      label: { en: 'Equipment', pl: 'Sprzęt' },
    },
    {
      name: 'occurredAt',
      type: 'date',
      required: true,
      label: { en: 'Occurred at', pl: 'Data przekazania' },
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' },
      },
    },
    // --- Exactly one of the three below; `validateEquipmentEvent` is the enforcement. ---
    {
      name: 'holder',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Holder', pl: 'Pracownik' },
    },
    {
      name: 'warehouse',
      type: 'relationship',
      relationTo: 'warehouses',
      label: { en: 'Warehouse', pl: 'Magazyn' },
    },
    {
      name: 'serviceProvider',
      type: 'text',
      label: { en: 'Service provider', pl: 'Serwis' },
    },
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
    },
    {
      name: 'cost',
      type: 'number',
      min: 0,
      label: { en: 'Cost', pl: 'Koszt' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: { en: 'Note', pl: 'Notatka' },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Created by', pl: 'Wpisał' },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: { en: 'Attachments', pl: 'Załączniki' },
    },
  ],
}
