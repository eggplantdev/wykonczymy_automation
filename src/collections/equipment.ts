import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/collections/hooks/revalidate-collection'
import { makeResetBookkeeping } from '@/collections/hooks/reset-bookkeeping'
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { resetWarrantyBookkeeping } from '@/lib/equipment/reset-warranty-bookkeeping'
import { trashedAtField } from '@/collections/fields/trashed-at'

export const Equipment: CollectionConfig = {
  slug: 'equipment',
  labels: {
    singular: { en: 'Equipment', pl: 'Sprzęt' },
    plural: { en: 'Equipment', pl: 'Sprzęt' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'make', 'model', 'serialNumber', 'status'],
    group: { en: 'Equipment', pl: 'Sprzęt' },
  },
  hooks: {
    // A unique index treats '' as a value, so two items saved from /admin with the serial left blank
    // collide on `equipment_serial_number_idx`.
    beforeValidate: [
      ({ data }) => (data?.serialNumber === '' ? { ...data, serialNumber: null } : data),
    ],
    beforeChange: [makeResetBookkeeping(resetWarrantyBookkeeping)],
    afterChange: [makeRevalidateAfterChange('equipment')],
    afterDelete: [makeRevalidateAfterDelete('equipment', 'equipmentEvents')],
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
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      name: 'serialNumber',
      type: 'text',
      unique: true,
      label: { en: 'Serial number', pl: 'Numer seryjny' },
    },
    {
      name: 'make',
      type: 'text',
      label: { en: 'Make', pl: 'Marka' },
    },
    {
      name: 'model',
      type: 'text',
      label: { en: 'Model', pl: 'Model' },
    },
    {
      name: 'purchaseDate',
      type: 'date',
      label: { en: 'Purchase date', pl: 'Data zakupu' },
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' },
      },
    },
    {
      name: 'warrantyUntil',
      type: 'date',
      label: { en: 'Warranty until', pl: 'Gwarancja do' },
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' },
      },
    },
    {
      name: 'purchasePrice',
      type: 'number',
      min: 0,
      label: { en: 'Purchase price', pl: 'Cena zakupu' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: { en: 'Note', pl: 'Uwagi' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'IN_USE',
      label: { en: 'Status', pl: 'Status' },
      options: EQUIPMENT_STATUSES.map((value) => ({
        label: EQUIPMENT_STATUS_LABELS[value],
        value,
      })),
    },
    {
      name: 'warrantyNotifiedBucket',
      type: 'number',
      admin: { hidden: true },
    },
    {
      name: 'warrantyNotifiedAt',
      type: 'date',
      admin: { hidden: true },
    },
    trashedAtField(),
  ],
}
