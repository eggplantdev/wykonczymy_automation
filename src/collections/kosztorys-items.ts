import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// Pozycja rozpiski. Cena klienta = snapshot. Ceny podwykonawcy wyprowadzane ze
// współczynnika narzutu (sekcja/inwestycja), z dwustanowym override per pozycja:
// *OverrideType ∈ {coeff, amount} | null (null = wyprowadź), *OverrideValue. Wartość
// liczona z measuredQty (pomiar). costVariant = null = "dziedzicz z sekcji".
// VAT nie żyje tu — jedna stawka na inwestycji (vat per investment).
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
