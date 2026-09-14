import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Labor cost sheet section (a header grouping items). VAT does not live on the section —
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
    create: createUnlessInvestmentLocked('investment'),
    update: unlessInvestmentLocked('investment.status'),
    delete: unlessInvestmentLocked('investment.status'),
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'name', type: 'text', required: true, label: { en: 'Name', pl: 'Nazwa' } },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    // Palette key from src/lib/kosztorys/section-colors.ts (text, not a select → pg enum: the
    // palette is a design-system list that grows, and each new swatch would otherwise owe an
    // ALTER TYPE). null = unpinned → the pie falls back to its positional palette.
    { name: 'color', type: 'text', label: { en: 'Color', pl: 'Kolor' } },
  ],
}
