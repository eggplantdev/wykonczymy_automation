import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { REVIEW_STATUSES } from '@/lib/kosztorys/review-status'

// Subcontractor prices are derived from the markup coefficient (investment), with one nullable
// per-item stawka per tool plane: a number is a kwota frozen onto the praca, NULL means „auto" —
// derive it from the coefficient. `0` is a kwota like any other, so neither field may carry a
// `defaultValue`: Payload treats a stored NULL as present-but-empty and would backfill it, turning
// every „auto" praca into 0 zł (EX-766).
// „Pomiar z natury" (the executed quantity) is not stored — it is the stage sum (Σ D:M in the
// sheet), computed live in the settlement layer.
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
    create: createUnlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    update: unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
    delete: unlessInvestmentLocked(isAdminOrOwnerOrManager, 'investment'),
  },
  fields: [
    { name: 'investment', type: 'relationship', relationTo: 'investments', required: true },
    { name: 'section', type: 'relationship', relationTo: 'kosztorys-sections', required: true },
    { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'description', type: 'text', label: { en: 'Description', pl: 'Opis' } },
    // { [language]: { text, source } } — `source` is the opis the translation was made from, so a
    // translation whose source no longer matches the opis reads as out of date.
    { name: 'descriptionTranslations', type: 'json', defaultValue: {} },
    { name: 'unit', type: 'text', label: { en: 'Unit', pl: 'Jednostka' } },
    { name: 'plannedQty', type: 'number', required: true, defaultValue: 0 },
    // Aktualizacja przedmiaru. Only a hand edit is stored — NULL follows plannedQty.
    { name: 'currentPlannedQty', type: 'number' },
    { name: 'sheetMeasuredQty', type: 'number', admin: { readOnly: true } },
    { name: 'discountType', type: 'text' },
    { name: 'discountValue', type: 'number', required: true, defaultValue: 0 },
    { name: 'clientPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'wToolsOverrideValue', type: 'number' },
    { name: 'ownToolsOverrideValue', type: 'number' },
    // At most one of the pair is ever non-null — an invariant `updateItemFieldAction` enforces, since
    // nothing here can.
    { name: 'wToolsOverrideCoeff', type: 'number', min: 0 },
    { name: 'ownToolsOverrideCoeff', type: 'number', min: 0 },
    { name: 'note', type: 'text', label: { en: 'Note', pl: 'Komentarz' } },
    { name: 'catalogueItemId', type: 'number', admin: { readOnly: true } },
    {
      name: 'aiPlannedQty',
      type: 'number',
      access: { create: () => false, update: () => false },
      label: { en: 'AI planned qty', pl: 'AI przedmiar' },
    },
    // Its own pair of fields, never Komentarz: that one the investor may be shown.
    {
      name: 'aiMissingData',
      type: 'text',
      access: { create: () => false, update: () => false },
      label: { en: 'AI: unknown', pl: 'Czego nie było wiadomo' },
    },
    {
      name: 'aiAssumptions',
      type: 'text',
      access: { create: () => false, update: () => false },
      label: { en: 'AI: assumed', pl: 'Co / ile założono' },
    },
    {
      name: 'aiNewInformation',
      type: 'textarea',
      access: { create: () => false, update: () => false },
      label: { en: 'AI: new information', pl: 'Nowe informacje' },
    },
    {
      name: 'aiRecheck',
      type: 'checkbox',
      defaultValue: false,
      access: { create: () => false, update: () => false },
      label: { en: 'AI: recheck', pl: 'Do ponownego sprawdzenia' },
    },
    { name: 'changeReason', type: 'text', label: { en: 'Change reason', pl: 'Powód zmiany' } },
    {
      name: 'reviewStatus',
      type: 'select',
      options: [...REVIEW_STATUSES],
      label: { en: 'Review status', pl: 'Status' },
    },
  ],
}
