import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'

const STATUS_OPTIONS = [
  { label: { en: 'Planned', pl: 'Planowana' }, value: 'planowana' },
  { label: { en: 'Active', pl: 'Aktywna' }, value: 'active' },
  { label: { en: 'Completed', pl: 'Zakończona' }, value: 'completed' },
] as const

export const Investments: CollectionConfig = {
  slug: 'investments',
  labels: {
    singular: { en: 'Investment', pl: 'Inwestycja' },
    plural: { en: 'Investments', pl: 'Inwestycje' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('investments')],
    afterDelete: [makeRevalidateAfterDelete('investments')],
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwnerOrManager,
    delete: isAdminOrOwner,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      name: 'address',
      type: 'text',
      label: { en: 'Address', pl: 'Adres' },
    },
    {
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', pl: 'Telefon' },
    },
    {
      name: 'email',
      type: 'email',
      label: { en: 'Email', pl: 'Email' },
    },
    {
      name: 'contactPerson',
      type: 'text',
      label: { en: 'Contact Person', pl: 'Osoba kontaktowa' },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: { en: 'Notes', pl: 'Notatki' },
    },
    {
      name: 'review',
      type: 'textarea',
      label: { en: 'Review', pl: 'Opinia' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: { en: 'Status', pl: 'Status' },
      options: [...STATUS_OPTIONS],
    },
    // Global (per-investment) subcontractor markup coefficients — the defaults for the sheet;
    // a section may override them, and an item may override them. Columns created in a migration with defaults.
    {
      name: 'wToolsCoeff',
      type: 'number',
      defaultValue: DEFAULT_COEFFS.wTools,
      label: {
        en: 'Subcontractor coeff (with tools)',
        pl: 'Współczynnik podwykonawcy (z narzędziami)',
      },
    },
    {
      name: 'ownToolsCoeff',
      type: 'number',
      defaultValue: DEFAULT_COEFFS.ownTools,
      label: {
        en: 'Subcontractor coeff (own tools)',
        pl: 'Współczynnik podwykonawcy (bez narzędzi)',
      },
    },
    // Per-investment VAT rate, stored as a fraction (0.08 = 8%). Kosztorys prices are netto;
    // brutto is computed. Edited from the kosztorys editor (Sekcje panel), not typically here.
    {
      name: 'vatRate',
      type: 'number',
      defaultValue: DEFAULT_VAT,
      label: { en: 'VAT rate (fraction)', pl: 'Stawka VAT (ułamek)' },
    },
    // Global kosztorys discount: amount-only ('amount' | null). Overrides per-item discounts and is
    // subtracted once from the executed total. `type` null = no global discount (per-item discounts
    // apply). A percent global rabat is no longer stored — it's stamped into each per-item rabat.
    // Edited from the kosztorys editor settings bar, not typically here.
    {
      name: 'globalDiscountType',
      type: 'text',
      label: { en: 'Global discount type', pl: 'Rabat globalny — typ' },
    },
    {
      name: 'globalDiscountValue',
      type: 'number',
      defaultValue: 0,
      label: { en: 'Global discount value', pl: 'Rabat globalny — wartość' },
    },
  ],
}
