import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Sekcja rozpiski robocizny (nagłówek grupujący pozycje). defaultCostVariant
// kaskaduje na pozycje (pozycja dziedziczy, może nadpisać). VAT nie żyje na sekcji —
// jedna stawka na inwestycji (vat per investment).
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
    // Współczynnik narzutu podwykonawcy per sekcja; null = dziedziczy globalny z inwestycji.
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
