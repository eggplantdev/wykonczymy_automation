import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Pozycja rozpiski. Ceny = niezależne snapshoty (nie formuła). Wartość liczona z
// measuredQty (pomiar), nie plannedQty (przedmiar). costVariant/vatRate = null
// oznacza "dziedzicz z sekcji". discountType ∈ {percent, amount} (walidacja w akcji).
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
    { name: 'subcontractorWToolsPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'subcontractorOwnToolsPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'costVariant', type: 'text' },
    { name: 'vatRate', type: 'number' },
    { name: 'hiddenInExport', type: 'checkbox', required: true, defaultValue: false },
    { name: 'note', type: 'text', label: { en: 'Note', pl: 'Komentarz' } },
  ],
}
