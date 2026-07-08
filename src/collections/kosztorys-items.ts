import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// A sheet item. Client price = a snapshot. Subcontractor prices are derived from the
// markup coefficient (section/investment), with a two-state per-item override:
// *OverrideType ∈ {coeff, amount} | null (null = derive), *OverrideValue. The value is
// computed from measuredQty (the measurement). costVariant = null = "inherit from section".
// VAT does not live here — there is a single rate per investment (S-12, not yet implemented).
export const KosztorysItems: CollectionConfig = {
  slug: 'kosztorys-items',
  labels: {
    singular: { en: 'Kosztorys Item', pl: 'Pozycja kosztorysu' },
    plural: { en: 'Kosztorys Items', pl: 'Pozycje kosztorysu' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'section', 'measuredQty', 'clientPrice'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysItems')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysItems')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwnerOrManager,
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'section', type: 'relationship', relationTo: 'kosztorys-sections', required: true },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'description', type: 'text', label: { en: 'Description', pl: 'Opis' } },
    { name: 'unit', type: 'text', label: { en: 'Unit', pl: 'Jednostka' } },
    { name: 'plannedQty', type: 'number', required: true, defaultValue: 0 },
    { name: 'measuredQty', type: 'number', required: true, defaultValue: 0 },
    { name: 'discountType', type: 'text' },
    { name: 'discountValue', type: 'number', required: true, defaultValue: 0 },
    { name: 'clientPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'wToolsOverrideType', type: 'text' },
    { name: 'wToolsOverrideValue', type: 'number', defaultValue: 0 },
    { name: 'ownToolsOverrideType', type: 'text' },
    { name: 'ownToolsOverrideValue', type: 'number', defaultValue: 0 },
    { name: 'costVariant', type: 'text' },
    { name: 'hiddenInExport', type: 'checkbox', required: true, defaultValue: false },
    { name: 'note', type: 'text', label: { en: 'Note', pl: 'Komentarz' } },
  ],
}
