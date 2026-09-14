import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { validateEquipmentEvent } from '@/hooks/equipment/validate'

/**
 * Append-only log of handovers and repairs — the single source of „where is it" and „who had it
 * last". A new row invalidates the previous one by definition, so there is no pair of
 * issue/return operations and no „in transit" state: returning to a warehouse IS a handover whose
 * target happens to be a warehouse.
 */
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
      // What „current" is ordered by — the day the handover happened, not the day it was typed in.
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
      // Free text, not a dictionary: a workshop shows up once per repair and is never grouped by,
      // so there would be nothing to maintain. Warehouses are the opposite — see `warehouses.ts`.
      name: 'serviceProvider',
      type: 'text',
      label: { en: 'Service provider', pl: 'Serwis' },
    },
    {
      // An attribute of the handover, not an axis of the module: the person is accountable for the
      // item, the investment merely says what they took it for, and it expires with the row.
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
    },
    {
      // Only meaningful on a service entry, and nulled elsewhere by the hook. Optional there too:
      // the invoice arrives after the tool does, so the amount is filled in by editing the row.
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
      // Provenance, filled by the server action — never by the form. The log says who had the tool;
      // this says who claims so, which is the only lead left when the two disagree.
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
