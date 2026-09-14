import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

// A sheet item. Client price = a snapshot. Subcontractor prices are derived from the
// markup coefficient (investment), with one nullable per-item stawka per tool plane: a number is a
// kwota frozen onto the praca, NULL means „auto" — derive it from the coefficient. `0` is a kwota
// like any other, so neither field may carry a `defaultValue`: Payload treats a stored NULL as
// present-but-empty and would backfill it, turning every „auto" praca into 0 zł (EX-766).
// „Pomiar z natury"
// (the executed quantity) is not stored — it is the stage sum (Σ D:M in the sheet), computed
// live in the settlement layer. `sheetMeasuredQty` is not a second answer to that: it records what
// the imported sheet CLAIMED, prices nothing, and exists only to be compared against the stage sum.
// VAT does not live here — there is a single rate per investment (S-12, not yet implemented).
export const KosztorysItems: CollectionConfig = {
  slug: 'kosztorys-items',
  labels: {
    singular: { en: 'Kosztorys Item', pl: 'Pozycja kosztorysu' },
    plural: { en: 'Kosztorys Items', pl: 'Pozycje kosztorysu' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'section', 'plannedQty', 'clientPrice'],
    group: { en: 'Kosztorys', pl: 'Kosztorys' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('kosztorysItems')],
    afterDelete: [makeRevalidateAfterDelete('kosztorysItems')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: createUnlessInvestmentLocked('investment'),
    update: unlessInvestmentLocked('investment.status'),
    delete: unlessInvestmentLocked('investment.status'),
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'section', type: 'relationship', relationTo: 'kosztorys-sections', required: true },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'description', type: 'text', label: { en: 'Description', pl: 'Opis' } },
    { name: 'unit', type: 'text', label: { en: 'Unit', pl: 'Jednostka' } },
    { name: 'plannedQty', type: 'number', required: true, defaultValue: 0 },
    { name: 'sheetMeasuredQty', type: 'number', admin: { readOnly: true } },
    { name: 'discountType', type: 'text' },
    { name: 'discountValue', type: 'number', required: true, defaultValue: 0 },
    { name: 'clientPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'wToolsOverrideValue', type: 'number' },
    { name: 'ownToolsOverrideValue', type: 'number' },
    { name: 'note', type: 'text', label: { en: 'Note', pl: 'Komentarz' } },
  ],
}
