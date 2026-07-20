import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'
import {
  canBeSettled,
  isDepositType,
  needsExpenseCategory,
  needsOtherCategory,
  needsSourceRegister,
  needsTargetRegister,
  showsInvestment,
  type TransferTypeT,
} from '@/lib/constants/transfers'
import { validateTransfer } from '@/hooks/transfers/validate'
import { recalcAfterChange, recalcAfterDelete } from '@/hooks/transfers/recalculate-balances'
import { syncSheetAfterChange, syncSheetAfterDelete } from '@/hooks/transfers/sync-sheet'

const TRANSFER_TYPES = [
  { label: { en: 'Investor Deposit', pl: 'Wpłata od inwestora' }, value: 'INVESTOR_DEPOSIT' },
  { label: { en: 'Company Funding', pl: 'Zasilenie z konta firmowego' }, value: 'COMPANY_FUNDING' },
  { label: { en: 'Other Deposit', pl: 'Inna wpłata' }, value: 'OTHER_DEPOSIT' },
  { label: { en: 'Investment Expense', pl: 'Wydatek inwestycyjny' }, value: 'INVESTMENT_EXPENSE' },
  { label: { en: 'Labor Cost', pl: 'Koszty robocizny' }, value: 'LABOR_COST' },
  { label: { en: 'Rebate', pl: 'Rabat' }, value: 'RABAT' },
  { label: { en: 'Loss', pl: 'Strata' }, value: 'LOSS' },
  {
    label: { en: 'Register Transfer', pl: 'Transfer między kasami' },
    value: 'REGISTER_TRANSFER',
  },
  { label: { en: 'Payout', pl: 'Wypłata' }, value: 'PAYOUT' },
  { label: { en: 'Other Expense', pl: 'Inny wydatek' }, value: 'OTHER' },
  { label: { en: 'Correction', pl: 'Korekta' }, value: 'CORRECTION' },
  { label: { en: 'Cancellation', pl: 'Anulowanie' }, value: 'CANCELLATION' },
] as const satisfies readonly { label: { en: string; pl: string }; value: TransferTypeT }[]

// The `satisfies` above rejects any value outside the TransferTypeT union; this asserts
// the reverse — every union member has an option here — so adding a type to the const
// source without wiring its Payload option fails typecheck instead of drifting silently.
type _AllTransferTypesCovered = TransferTypeT extends (typeof TRANSFER_TYPES)[number]['value']
  ? true
  : never
const _assertAllTransferTypesCovered: _AllTransferTypesCovered = true
void _assertAllTransferTypesCovered

const PAYMENT_METHODS = [
  { label: { en: 'Cash', pl: 'Gotówka' }, value: 'CASH' },
  { label: { en: 'BLIK', pl: 'BLIK' }, value: 'BLIK' },
  { label: { en: 'Transfer', pl: 'Przelew' }, value: 'TRANSFER' },
  { label: { en: 'Card', pl: 'Karta' }, value: 'CARD' },
] as const

const typeOf = (data: Record<string, unknown>) => String(data?.type)

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
    afterChange: [recalcAfterChange, syncSheetAfterChange],
    afterDelete: [recalcAfterDelete, syncSheetAfterDelete],
  },
  fields: [
    {
      name: 'description',
      type: 'text',
      label: { en: 'Description', pl: 'Opis' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      label: { en: 'Amount', pl: 'Kwota' },
      access: { update: () => false },
      admin: {
        description: {
          en: 'Positive for most types — CORRECTION allows negative (invoice corrections)',
          pl: 'Dodatnia dla większości typów — KOREKTA pozwala na ujemne (korekty faktur)',
        },
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: { en: 'Date', pl: 'Data' },
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
    },
    {
      name: 'sourceRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      required: false,
      label: { en: 'Source Register', pl: 'Kasa' },
      access: { update: () => false },
      admin: {
        condition: (data) => needsSourceRegister(typeOf(data)),
      },
    },
    {
      name: 'targetRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Target Register', pl: 'Kasa docelowa' },
      access: { update: () => false },
      admin: {
        condition: (data) => needsTargetRegister(typeOf(data)),
      },
    },
    // --- Conditional fields based on type ---
    {
      name: 'investment',
      type: 'relationship',
      relationTo: 'investments',
      label: { en: 'Investment', pl: 'Inwestycja' },
      admin: {
        condition: (data) => showsInvestment(typeOf(data)),
      },
    },
    {
      // Read-only bridge to the kosztorys plane: tagging a deposit with an etap declares it a
      // zaliczka against that stage. Meaningful only for deposit types; the kosztorys editor
      // reads these sums but never writes here (FR-015 write firewall stays).
      name: 'kosztorysStage',
      type: 'relationship',
      relationTo: 'kosztorys-stages',
      label: { en: 'Advance for stage', pl: 'Zaliczka na etap' },
      admin: {
        condition: (data) => isDepositType(typeOf(data)),
      },
    },
    {
      name: 'expenseCategory',
      type: 'relationship',
      relationTo: 'expense-categories',
      label: { en: 'Investment Expense Type', pl: 'Typ wydatku inwestycyjnego' },
      admin: {
        condition: (data) => needsExpenseCategory(typeOf(data), !!data?.investment),
      },
    },
    {
      name: 'worker',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Worker', pl: 'Pracownik' },
      access: { update: () => false },
      admin: {
        condition: (data) => data?.type === 'PAYOUT',
      },
    },
    {
      name: 'otherCategory',
      type: 'relationship',
      relationTo: 'other-categories',
      label: { en: 'Category', pl: 'Kategoria' },
      admin: {
        condition: (data) => needsOtherCategory(typeOf(data)),
      },
    },
    {
      name: 'otherDescription',
      type: 'textarea',
      label: { en: 'Category Description', pl: 'Opis kategorii' },
      admin: {
        condition: (data) => needsOtherCategory(typeOf(data)),
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
    // --- Cancellation ---
    {
      name: 'cancelled',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Cancelled', pl: 'Anulowane' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'cancelledTransaction',
      type: 'relationship',
      relationTo: 'transactions',
      label: { en: 'Cancelled Transaction', pl: 'Anulowana transakcja' },
      admin: {
        readOnly: true,
        position: 'sidebar',
        condition: (data) => data?.type === 'CANCELLATION',
      },
    },
    {
      name: 'settled',
      type: 'checkbox',
      defaultValue: false,
      label: { en: 'Included in labour (R+M)', pl: 'Wliczone w robociznę' },
      admin: {
        condition: (data) => canBeSettled(data?.type),
        description: {
          en: 'Material already priced into robocizna: leaves the register, reduces margin, NOT billed to the client.',
          pl: 'Materiał już zawarty w cenie robocizny: schodzi z kasy, obniża marżę, klient NIE płaci za niego osobno.',
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
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Updated By', pl: 'Zaktualizowane przez' },
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
