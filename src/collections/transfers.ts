import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'
import { validateTransfer } from '@/hooks/transfers/validate'
import { recalcAfterChange, recalcAfterDelete } from '@/hooks/transfers/recalculate-balances'

const TRANSFER_TYPES = [
  { label: { en: 'Investor Deposit', pl: 'Wpłata od inwestora' }, value: 'INVESTOR_DEPOSIT' },
  { label: { en: 'Stage Settlement', pl: 'Rozliczenie etapu' }, value: 'STAGE_SETTLEMENT' },
  { label: { en: 'Company Funding', pl: 'Zasilenie z konta firmowego' }, value: 'COMPANY_FUNDING' },
  { label: { en: 'Other Deposit', pl: 'Inna wpłata' }, value: 'OTHER_DEPOSIT' },
  { label: { en: 'Investment Expense', pl: 'Wydatek inwestycyjny' }, value: 'INVESTMENT_EXPENSE' },
  {
    label: { en: 'Account Funding', pl: 'Zasilenie konta współpracownika' },
    value: 'ACCOUNT_FUNDING',
  },
  { label: { en: 'Employee Expense', pl: 'Wydatek pracowniczy' }, value: 'EMPLOYEE_EXPENSE' },
  {
    label: { en: 'Register Transfer', pl: 'Transfer między kasami' },
    value: 'REGISTER_TRANSFER',
  },
  { label: { en: 'Payout', pl: 'Wypłata' }, value: 'PAYOUT' },
  { label: { en: 'Other', pl: 'Inne' }, value: 'OTHER' },
] as const

const PAYMENT_METHODS = [
  { label: { en: 'Cash', pl: 'Gotówka' }, value: 'CASH' },
  { label: { en: 'BLIK', pl: 'BLIK' }, value: 'BLIK' },
  { label: { en: 'Transfer', pl: 'Przelew' }, value: 'TRANSFER' },
  { label: { en: 'Card', pl: 'Karta' }, value: 'CARD' },
] as const

/** Show sourceRegister for all types except EMPLOYEE_EXPENSE */
const showSourceRegister = (data: Record<string, unknown>) => data?.type !== 'EMPLOYEE_EXPENSE'

/** Show investment field for types that use it (required or optional) */
const showInvestment = (data: Record<string, unknown>) =>
  data?.type === 'INVESTOR_DEPOSIT' ||
  data?.type === 'INVESTMENT_EXPENSE' ||
  data?.type === 'EMPLOYEE_EXPENSE'

/** Show field when type includes worker */
const needsWorker = (data: Record<string, unknown>) =>
  data?.type === 'ACCOUNT_FUNDING' || data?.type === 'EMPLOYEE_EXPENSE'

/** Show targetRegister only for REGISTER_TRANSFER */
const showTargetRegister = (data: Record<string, unknown>) => data?.type === 'REGISTER_TRANSFER'

/** Show field when type is OTHER */
const needsOtherCategory = (data: Record<string, unknown>) =>
  data?.type === 'OTHER' || data?.type === 'EMPLOYEE_EXPENSE'

export const Transfers: CollectionConfig = {
  slug: 'transactions',
  labels: {
    singular: { en: 'Transfer', pl: 'Transfer' },
    plural: { en: 'Transfers', pl: 'Transfery' },
  },
  admin: {
    useAsTitle: 'description',
    defaultColumns: ['description', 'amount', 'type', 'date', 'sourceRegister'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: isAdminOrOwner,
    create: isAdminOrOwner,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
  },
  hooks: {
    beforeValidate: [validateTransfer],
    afterChange: [recalcAfterChange],
    afterDelete: [recalcAfterDelete],
  },
  fields: [
    {
      name: 'description',
      type: 'text',
      label: { en: 'Description', pl: 'Opis' },
      access: { update: () => false },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0.01,
      label: { en: 'Amount', pl: 'Kwota' },
      access: { update: () => false },
      admin: {
        description: {
          en: 'Always positive — direction is determined by type',
          pl: 'Zawsze dodatnia — kierunek wynika z typu',
        },
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: { en: 'Date', pl: 'Data' },
      access: { update: () => false },
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      label: { en: 'Type', pl: 'Typ' },
      options: [...TRANSFER_TYPES],
      access: { update: () => false },
    },
    {
      name: 'paymentMethod',
      type: 'select',
      required: true,
      label: { en: 'Payment Method', pl: 'Metoda płatności' },
      options: [...PAYMENT_METHODS],
      access: { update: () => false },
    },
    {
      name: 'sourceRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      required: false,
      label: { en: 'Source Register', pl: 'Kasa' },
      access: { update: () => false },
      admin: {
        condition: (data) => showSourceRegister(data),
      },
    },
    {
      name: 'targetRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Target Register', pl: 'Kasa docelowa' },
      access: { update: () => false },
      admin: {
        condition: (data) => showTargetRegister(data),
      },
    },
    // --- Conditional fields based on type ---
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
      access: { update: () => false },
      admin: {
        condition: (data) => showInvestment(data),
      },
    },
    {
      name: 'worker',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Worker', pl: 'Pracownik' },
      access: { update: () => false },
      admin: {
        condition: (data) => needsWorker(data),
      },
    },
    {
      name: 'otherCategory',
      type: 'relationship',
      relationTo: 'other-categories',
      label: { en: 'Category', pl: 'Kategoria' },
      access: { update: () => false },
      admin: {
        condition: (data) => needsOtherCategory(data),
      },
    },
    {
      name: 'otherDescription',
      type: 'textarea',
      label: { en: 'Category Description', pl: 'Opis kategorii' },
      access: { update: () => false },
      admin: {
        condition: (data) => needsOtherCategory(data),
      },
    },
    // --- Invoice documentation ---
    {
      name: 'invoice',
      type: 'upload',
      relationTo: 'media',
      label: { en: 'Invoice', pl: 'Faktura' },
    },
    {
      name: 'invoiceNote',
      type: 'textarea',
      label: { en: 'Invoice Note', pl: 'Notatka do faktury' },
      admin: {
        description: {
          en: 'Required if no invoice file is attached',
          pl: 'Wymagane jeśli nie załączono faktury',
        },
      },
    },
    // --- Metadata ---
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Created By', pl: 'Utworzone przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
