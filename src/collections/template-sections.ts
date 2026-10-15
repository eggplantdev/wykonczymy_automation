import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'

// Read-only for the same reason as `templates`.
export const TemplateSections: CollectionConfig = {
  slug: 'template-sections',
  labels: {
    singular: { en: 'Template Section', pl: 'Sekcja szablonu' },
    plural: { en: 'Template Sections', pl: 'Sekcje szablonu' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'template', 'displayOrder'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'template', type: 'relationship', relationTo: 'templates', required: true },
    { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    // Palette key from src/lib/kosztorys/section-colors.ts, as on `kosztorys-sections`.
    { name: 'color', type: 'text', label: { en: 'Color', pl: 'Kolor' } },
  ],
}
