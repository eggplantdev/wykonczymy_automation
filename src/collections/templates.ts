import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// The name is unique on `lower(trim(name))` INCLUDING trashed szablony (a migration index, since
// Payload's `unique` is exact-match only).
export const Templates: CollectionConfig = {
  slug: 'templates',
  labels: {
    singular: { en: 'Template', pl: 'Szablon' },
    plural: { en: 'Templates', pl: 'Szablony' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
    {
      name: 'trashedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
  ],
}
