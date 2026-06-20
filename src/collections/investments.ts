import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

const STATUS_OPTIONS = [
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
    // Globalne (na inwestycję) współczynniki narzutu podwykonawcy — domyślne dla kosztorysu;
    // sekcja może nadpisać, pozycja może nadpisać (override). Patrz docs/superpowers/specs/2026-06-20-kosztorys-subcontractor-pricing-design.md
    {
      name: 'wToolsCoeff',
      type: 'number',
      defaultValue: 0.65,
      label: {
        en: 'Subcontractor coeff (with tools)',
        pl: 'Współczynnik podwykonawcy (z narzędziami)',
      },
    },
    {
      name: 'ownToolsCoeff',
      type: 'number',
      defaultValue: 0.55,
      label: {
        en: 'Subcontractor coeff (own tools)',
        pl: 'Współczynnik podwykonawcy (bez narzędzi)',
      },
    },
    // Jedna stawka VAT na inwestycję (decyzja właściciela). Brutto wiersza = netto × (1 + vatRate).
    // Patrz docs/superpowers/specs/2026-06-20-kosztorys-vat-per-investment-design.md
    {
      name: 'vatRate',
      type: 'number',
      defaultValue: 0.08,
      label: { en: 'VAT rate', pl: 'Stawka VAT' },
    },
  ],
}
