import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Labor cost sheet section (a header grouping items). defaultCostVariant
// cascades to items (an item inherits it and may override). VAT does not live on the section —
// there is a single rate per investment (S-12, not yet implemented).
export const KosztorysSections: CollectionConfig = {
  slug: 'kosztorys-sections',
  labels: {
    singular: { en: 'Kosztorys Section', pl: 'Sekcja kosztorysu' },
    plural: { en: 'Kosztorys Sections', pl: 'Sekcje kosztorysu' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'investment', 'displayOrder'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysSections')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysSections')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    {
      name: 'defaultCostVariant',
      type: 'text',
      required: true,
      defaultValue: 'w_tools',
      label: { en: 'Default cost variant', pl: 'Domyślny wariant kosztu' },
    },
    // Per-section subcontractor markup coefficient; null = inherit the global one from the investment.
    {
      name: 'wToolsCoeff',
      type: 'number',
      label: { en: 'Coeff (with tools)', pl: 'Współczynnik (z narzędziami)' },
    },
    {
      name: 'ownToolsCoeff',
      type: 'number',
      label: { en: 'Coeff (own tools)', pl: 'Współczynnik (bez narzędzi)' },
    },
  ],
}
