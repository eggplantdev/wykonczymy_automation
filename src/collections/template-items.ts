import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

export const TemplateItems: CollectionConfig = {
  slug: 'template-items',
  labels: {
    singular: { en: 'Template Item', pl: 'Praca szablonu' },
    plural: { en: 'Template Items', pl: 'Prace szablonu' },
  },
  admin: {
    defaultColumns: ['catalogueItem', 'section', 'displayOrder'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'section', type: 'relationship', relationTo: 'template-sections', required: true },
    {
      name: 'catalogueItem',
      type: 'relationship',
      relationTo: 'work-catalogue-items',
      required: true,
    },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
  ],
}
