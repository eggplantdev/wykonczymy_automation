import type { CollectionConfig } from 'payload'
import { isAdminOrOwnerOrManager } from '@/access'
import { createUnlessInvestmentLocked, unlessInvestmentLocked } from '@/access/investment-lock'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { REVIEW_STATUSES } from '@/lib/kosztorys/review-status'

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
    // EX-921: Aktualizacja przedmiaru. Only a hand edit is stored — NULL follows plannedQty.
    { name: 'currentPlannedQty', type: 'number' },
    { name: 'sheetMeasuredQty', type: 'number', admin: { readOnly: true } },
    { name: 'discountType', type: 'text' },
    { name: 'discountValue', type: 'number', required: true, defaultValue: 0 },
    { name: 'clientPrice', type: 'number', required: true, defaultValue: 0 },
    { name: 'wToolsOverrideValue', type: 'number' },
    { name: 'ownToolsOverrideValue', type: 'number' },
    // The multiplier twin of the two above (EX-865): non-null = this praca's stawka is
    // `clientPrice × coeff`, recomputed on every read. At most one of the pair is ever non-null —
    // an invariant `updateItemFieldAction` enforces, since nothing here can.
    { name: 'wToolsOverrideCoeff', type: 'number', min: 0 },
    { name: 'ownToolsOverrideCoeff', type: 'number', min: 0 },
    { name: 'note', type: 'text', label: { en: 'Note', pl: 'Komentarz' } },
    // EX-1017: the katalog prac entry this pozycja was taken from or saved to. A soft reference —
    // no FK, so it may name an entry deleted since (see the migration).
    { name: 'catalogueItemId', type: 'number', admin: { readOnly: true } },
    // EX-1006: an agent's draft and the manager's review of it. AI przedmiar is written only by the
    // draft loader through the Local API — the grid shows it and never edits it.
    {
      name: 'aiPlannedQty',
      type: 'number',
      access: { create: () => false, update: () => false },
      label: { en: 'AI planned qty', pl: 'AI przedmiar' },
    },
    // EX-1030: Komentarz AI — what the inquiry left unknown and what `aiPlannedQty` assumed in its
    // place. Its own pair of fields, never Komentarz: that one the investor may be shown.
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
    { name: 'changeReason', type: 'text', label: { en: 'Change reason', pl: 'Powód zmiany' } },
    {
      name: 'reviewStatus',
      type: 'select',
      options: [...REVIEW_STATUSES],
      label: { en: 'Review status', pl: 'Status' },
    },
  ],
}
