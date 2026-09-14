import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { makeResetBookkeeping } from '@/hooks/reset-bookkeeping'
import { INSPECTION_TYPE_LABELS, INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { resetNotificationBookkeeping } from '@/lib/fleet/reset-notification-bookkeeping'

export const VehicleInspections: CollectionConfig = {
  slug: 'vehicle-inspections',
  labels: {
    singular: { en: 'Inspection', pl: 'Przegląd' },
    plural: { en: 'Inspections', pl: 'Przeglądy' },
  },
  admin: {
    useAsTitle: 'performedAt',
    defaultColumns: ['vehicle', 'type', 'performedAt', 'nextDueAt'],
    group: { en: 'Fleet', pl: 'Flota' },
  },
  hooks: {
    beforeChange: [makeResetBookkeeping(resetNotificationBookkeeping)],
    afterChange: [makeRevalidateAfterChange('vehicleInspections')],
    afterDelete: [makeRevalidateAfterDelete('vehicleInspections')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'vehicle',
      type: 'relationship',
      relationTo: 'vehicles',
      required: true,
      label: { en: 'Vehicle', pl: 'Pojazd' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: { en: 'Type', pl: 'Rodzaj' },
      options: INSPECTION_TYPES.map((value) => ({
        label: INSPECTION_TYPE_LABELS[value],
        value,
      })),
    },
    {
      name: 'performedAt',
      type: 'date',
      required: true,
      label: { en: 'Performed at', pl: 'Data wykonania' },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'nextDueAt',
      type: 'date',
      label: { en: 'Next due', pl: 'Następny termin' },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'odometer',
      type: 'number',
      label: { en: 'Odometer (km)', pl: 'Przebieg (km)' },
    },
    {
      // Both belong to the event, not to the car: each polisa brings its own insurer and number, and
      // only the history keeps that honest. Independently optional — the przyczepa's polisa has a
      // number but no insurer recorded.
      name: 'insurer',
      type: 'text',
      label: { en: 'Insurer', pl: 'Ubezpieczyciel' },
      admin: {
        condition: (data) => data?.type === 'INSURANCE',
      },
    },
    {
      // Text, never number: `354E000003305` is not finite as a float and `22044 4672279` has a space.
      name: 'policyNumber',
      type: 'text',
      label: { en: 'Policy number', pl: 'Nr polisy' },
      admin: {
        condition: (data) => data?.type === 'INSURANCE',
      },
    },
    {
      // Optional again (partly reversing EX-729): the imported sheet carries no prices at all, and a
      // required field would have turned nine unknowns into nine „0 zł". The invariant EX-729 bought
      // survives because unknown now renders „—" instead of collapsing into zero.
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
      name: 'attachments',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: { en: 'Attachments', pl: 'Załączniki' },
    },
    // --- Reminder bookkeeping: written by the daily sweep, edited by nobody. ---
    // Two independent axes because the date leg and the kilometre leg can each fire for the same
    // oil-change row; sharing one column would let either silence the other.
    {
      name: 'notifiedThreshold',
      type: 'number',
      admin: { hidden: true },
    },
    {
      name: 'notifiedAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'odometerNotifiedAt',
      type: 'date',
      admin: { hidden: true },
    },
  ],
}
