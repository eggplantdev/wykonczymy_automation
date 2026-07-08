import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

export const OtherCategories: CollectionConfig = {
  slug: 'other-categories',
  labels: {
    singular: { en: 'Other Category', pl: 'Inna kategoria' },
    plural: { en: 'Other Categories', pl: 'Inne kategorie' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('otherCategories')],
    afterDelete: [makeRevalidateAfterDelete('otherCategories')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
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
