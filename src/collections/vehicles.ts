import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { VEHICLE_STATUS_LABELS, VEHICLE_STATUSES } from '@/lib/fleet/vehicle-status'

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
  labels: {
    singular: { en: 'Vehicle', pl: 'Pojazd' },
    plural: { en: 'Vehicles', pl: 'Pojazdy' },
  },
  admin: {
    useAsTitle: 'registration',
    defaultColumns: ['registration', 'make', 'model', 'status'],
    group: { en: 'Fleet', pl: 'Flota' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('vehicles')],
    afterDelete: [makeRevalidateAfterDelete('vehicles', 'vehicleInspections')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'registration',
      type: 'text',
      required: true,
      // Unique index lives in the migration too (20260818_1) — single-column, so the two agree.
      unique: true,
      label: { en: 'Registration', pl: 'Numer rejestracyjny' },
    },
    {
      name: 'make',
      type: 'text',
      required: true,
      label: { en: 'Make', pl: 'Marka' },
    },
    {
      name: 'model',
      type: 'text',
      required: true,
      label: { en: 'Model', pl: 'Model' },
    },
    {
      name: 'year',
      type: 'number',
      label: { en: 'Year', pl: 'Rocznik' },
    },
    {
      name: 'vin',
      type: 'text',
      label: { en: 'VIN', pl: 'VIN' },
    },
    {
      // Machine-shaped: a map of inspection type → the day it was marked „do wymiany", written by
      // the vehicle page. Hidden because hand-editing raw JSON here would only corrupt it.
      name: 'flags',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'tyres',
      type: 'text',
      label: { en: 'Tyres', pl: 'Opony' },
    },
    {
      name: 'note',
      type: 'textarea',
      label: { en: 'Note', pl: 'Uwagi' },
    },
    {
      // An array of scheduled inspection types the car will never have — the przyczepa's przegląd is
      // „bezterminowo". Hidden for the same reason as `flags`: raw JSON typed by hand only corrupts it.
      name: 'exemptions',
      type: 'json',
      admin: { hidden: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'ACTIVE',
      label: { en: 'Status', pl: 'Status' },
      options: VEHICLE_STATUSES.map((value) => ({
        label: VEHICLE_STATUS_LABELS[value],
        value,
      })),
    },
    // Closed to access-checked writes: the trash actions (overrideAccess) stamp it server-side, so no
    // client-supplied date can bring the 30-day purge forward.
    {
      name: 'trashedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
  ],
}
