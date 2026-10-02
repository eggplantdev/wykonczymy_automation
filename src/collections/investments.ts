import type { CollectionConfig } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerOrManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { refuseDeleteWhen } from '@/hooks/prevent-delete'
import { investmentDeleteBlocker } from '@/lib/investments/delete-blocker'
import { guardInvestmentStatusUnlock } from '@/hooks/investments/guard-status-unlock'
import { guardTemplateStatus } from '@/hooks/investments/guard-template-status'
import { guardTrashedInvestment } from '@/hooks/investments/guard-trashed-investment'
import { stampCompletedAt } from '@/hooks/investments/stamp-completed-at'
import { INVESTMENT_STATUSES, INVESTMENT_STATUS_LABELS } from '@/lib/constants/investment-status'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import {
  SETTLEMENT_MODE_ADMIN_OPTIONS,
  SETTLEMENT_MODE_DEFAULT,
} from '@/lib/kosztorys/settlement-mode'

const STATUS_OPTIONS = INVESTMENT_STATUSES.map((value) => ({
  label: INVESTMENT_STATUS_LABELS[value],
  value,
}))

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
    beforeChange: [
      guardTrashedInvestment,
      guardInvestmentStatusUnlock,
      guardTemplateStatus,
      stampCompletedAt,
    ],
    beforeDelete: [refuseDeleteWhen(investmentDeleteBlocker)],
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
      name: 'reviewRequested',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Review requested', pl: 'Prośba o opinię wysłana' },
    },
    // Photos and documents of the site itself — the same `media` rows a promoted lead arrived with,
    // which is why promotion re-points them instead of re-uploading.
    {
      name: 'assets',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      label: { en: 'Photos and files', pl: 'Zdjęcia i pliki' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'quote',
      label: { en: 'Status', pl: 'Status' },
      options: STATUS_OPTIONS,
    },
    // Defaults for the sheet, which a single pozycja may override. „Bez narzędzi" is not independent:
    // the sheet derives it as „z narzędziami" less 15%, which is why DEFAULT_COEFFS owns both and the
    // column default had to be corrected to match (20260825_0).
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
    // A fraction (0.08 = 8%). Kosztorys prices are netto; brutto is computed. Edited from the
    // kosztorys editor (Sekcje panel).
    {
      name: 'vatRate',
      type: 'number',
      defaultValue: DEFAULT_VAT,
      label: { en: 'VAT rate (fraction)', pl: 'Stawka VAT (ułamek)' },
    },
    // `required` pairs with the column's NOT NULL: without it Payload lets the admin clear the select
    // and the write surfaces as a raw constraint violation instead of a field error.
    {
      name: 'settlementMode',
      type: 'select',
      required: true,
      defaultValue: SETTLEMENT_MODE_DEFAULT,
      label: { en: 'Settlement mode', pl: 'Sposób rozliczenia' },
      options: SETTLEMENT_MODE_ADMIN_OPTIONS,
    },
    // Materiały billed to the investor at netto instead of the brutto receipt, a fraction like
    // `vatRate`. Neither `required` nor defaulted: null means "no concession" and must stay
    // distinguishable from a 0% one, which is what leaves existing investments' figures untouched.
    {
      name: 'materialsNetRate',
      type: 'number',
      label: { en: 'Materials net rate (fraction)', pl: 'Stawka netto wydatków (ułamek)' },
    },
    // Amount-only ('amount' | null): overrides per-item discounts and is subtracted once from the
    // executed total; null means the per-item discounts apply. A percent global rabat is not stored —
    // it is stamped into each per-item rabat.
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
    // Written only by the trash actions (overrideAccess) — closed to REST, which would skip their
    // checks. Deliberately not `deletedAt`: that name is Payload's own `trash: true` column, which
    // fails reads closed.
    {
      name: 'trashedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
    // Set by the stampCompletedAt hook only; the investor's change history expires a year after it.
    {
      name: 'completedAt',
      type: 'date',
      admin: { hidden: true },
      label: { en: 'Completed at', pl: 'Zakończona dnia' },
    },
  ],
}
