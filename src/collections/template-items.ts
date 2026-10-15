import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// A szablon praca is a katalog entry in a section, in order — nothing else. Opis, j.m., cena,
// stawki and tłumaczenia are read from the katalog entry, so there is no copy to go stale; the FK
// cascades, so deleting the katalog entry takes the praca out of every szablon.
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
