import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { makeResetBookkeeping } from '@/hooks/reset-bookkeeping'
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUSES } from '@/lib/equipment/equipment-status'
import { resetWarrantyBookkeeping } from '@/lib/equipment/reset-warranty-bookkeeping'

/**
 * One row per PHYSICAL ITEM. Deliberately no „quantity" field: the threshold between sprzęt and
 * materiał is enforced by the shape rather than by a rule nobody reads — drill bits and cutting
 * discs have no way in. Nor does the item say where it is; that is the newest event's answer
 * (`equipment-events`), because a field overwritten on every handover loses the trail that answers
 * „who had it when it disappeared".
 */
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
    // collide on `equipment_serial_number_idx`. The form sends null; only /admin sends ''.
    beforeValidate: [
      ({ data }) =>
        data?.serialNumber === '' ? { ...data, serialNumber: null } : data,
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
      // Not unique: three „szlifierka"s are a normal inventory, and the serial number is what tells
      // them apart. This is what you search and click on.
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      // Optional but unique when given: requiring it would block the register from ever being
      // started, since nobody will copy a hundred nameplates up front. Unique index lives in the
      // migration too — single-column, so the two agree.
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
      // Optional for the same reason as an inspection's cost: an unknown price must render „—",
      // never „0 zł".
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
    // --- Warranty reminder bookkeeping: written by the daily sweep, edited by nobody. ---
    // One axis only, unlike the fleet's two: a warranty has a date and no odometer.
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
  ],
}
