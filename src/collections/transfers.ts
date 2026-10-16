import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'
import {
  canBeSettled,
  carriesNetAmount,
  carriesPayoutStatus,
  hasOptionalWorker,
  needsExpenseCategory,
  needsOtherCategory,
  needsSourceRegister,
  needsTargetRegister,
  showsInvestment,
  showsWorker,
  type TransferTypeT,
} from '@/lib/constants/transfers'
import type { PayoutStatusT } from '@/lib/constants/payout-confirmation'
import { validateTransfer } from '@/hooks/transfers/validate'
import { guardDeleteOnLockedInvestment } from '@/hooks/transfers/guard-delete'
import { recalcAfterChange, recalcAfterDelete } from '@/hooks/transfers/recalculate-balances'
import { syncSheetAfterChange, syncSheetAfterDelete } from '@/hooks/transfers/sync-sheet'
import { deleteInvoiceMediaAfterDelete } from '@/hooks/transfers/delete-invoice-media'

const TRANSFER_TYPES = [
  { label: { en: 'Investor Deposit', pl: 'Wpłata od inwestora' }, value: 'INVESTOR_DEPOSIT' },
  { label: { en: 'Company Funding', pl: 'Zasilenie z konta firmowego' }, value: 'COMPANY_FUNDING' },
  { label: { en: 'Other Deposit', pl: 'Inna wpłata' }, value: 'OTHER_DEPOSIT' },
  { label: { en: 'Investment Expense', pl: 'Wydatek inwestycyjny' }, value: 'INVESTMENT_EXPENSE' },
  {
    label: { en: 'Investment Expense (net)', pl: 'Wydatek inwestycyjny netto' },
    value: 'INVESTMENT_EXPENSE_NET',
  },
  { label: { en: 'Labor Cost', pl: 'Koszty robocizny' }, value: 'LABOR_COST' },
  { label: { en: 'Rebate', pl: 'Rabat' }, value: 'RABAT' },
  { label: { en: 'Loss', pl: 'Strata' }, value: 'LOSS' },
  { label: { en: 'Bonus', pl: 'Premia' }, value: 'BONUS' },
  {
    label: { en: 'Register Transfer', pl: 'Transfer między kasami' },
    value: 'REGISTER_TRANSFER',
  },
  { label: { en: 'Payout', pl: 'Wypłata' }, value: 'PAYOUT' },
  { label: { en: 'Other Expense', pl: 'Inny wydatek' }, value: 'OTHER' },
  { label: { en: 'Correction', pl: 'Korekta' }, value: 'CORRECTION' },
  { label: { en: 'Cancellation', pl: 'Anulowanie' }, value: 'CANCELLATION' },
] as const satisfies readonly { label: { en: string; pl: string }; value: TransferTypeT }[]

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
    beforeDelete: [guardDeleteOnLockedInvestment],
    afterChange: [recalcAfterChange, syncSheetAfterChange],
    afterDelete: [recalcAfterDelete, syncSheetAfterDelete, deleteInvoiceMediaAfterDelete],
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
          en: 'Positive for most types — CORRECTION must be negative (invoice corrections)',
          pl: 'Dodatnia dla większości typów — KOREKTA musi być ujemna (korekty faktur)',
        },
      },
    },
    {
      name: 'netAmount',
      type: 'number',
      label: { en: 'Net amount', pl: 'Kwota netto' },
      access: { update: ({ doc }) => doc?.netAmount == null },
      admin: {
        condition: (data) => carriesNetAmount(typeOf(data), data?.vatPlane),
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
      // Not `required`: rows booked before that carry a method nobody chose.
      name: 'paymentMethod',
      type: 'select',
      label: { en: 'Payment Method', pl: 'Metoda płatności' },
      options: [...PAYMENT_METHODS],
    },
    {
      // it STRIPS rather than refuses, and only on /admin and REST: a Local API write defaults to
      // `overrideAccess: true` and skips field access entirely.
      name: 'vatPlane',
      type: 'select',
      label: { en: 'Deposit VAT plane', pl: 'Rozliczenie netto/brutto' },
      access: { update: ({ doc }) => doc?.vatPlane == null },
      options: [
        { label: { en: 'Net', pl: 'Netto' }, value: 'NET' },
        { label: { en: 'Gross', pl: 'Brutto' }, value: 'GROSS' },
      ],
      admin: {
        condition: (data) => typeOf(data) === 'INVESTOR_DEPOSIT',
      },
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
      access: { update: ({ doc }) => hasOptionalWorker(typeOf(doc ?? {})) },
      admin: {
        condition: (data) => showsWorker(typeOf(data)),
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
    {
      name: 'invoice',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
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
    {
      name: 'documentNumber',
      type: 'text',
      label: { en: 'Document number', pl: 'Nr dokumentu' },
    },
    {
      name: 'sellerNip',
      type: 'text',
      label: { en: 'Seller NIP', pl: 'NIP sprzedawcy' },
    },
    {
      // ISO `YYYY-MM-DD` text: a Payload `date` is a timestamptz, which would shift a date-only value.
      name: 'documentDate',
      type: 'text',
      label: { en: 'Document date', pl: 'Data na paragonie' },
    },
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
          pl: 'Materiał już zawarty w cenie robocizny: schodzi z kasy, obniża marżę, inwestor NIE płaci za niego osobno.',
        },
      },
    },
    {
      name: 'payoutStatus',
      type: 'select',
      options: [
        { label: { en: 'Awaiting confirmation', pl: 'Czeka na potwierdzenie' }, value: 'pending' },
        { label: { en: 'Confirmed', pl: 'Potwierdzona' }, value: 'accepted' },
        { label: { en: 'Rejected', pl: 'Odrzucona' }, value: 'rejected' },
      ] satisfies { label: { en: string; pl: string }; value: PayoutStatusT }[],
      label: { en: 'Worker confirmation', pl: 'Potwierdzenie pracownika' },
      access: { update: () => false },
      admin: { readOnly: true, condition: (data) => carriesPayoutStatus(typeOf(data)) },
    },
    {
      name: 'payoutDecidedAt',
      type: 'date',
      label: { en: 'Decided at', pl: 'Data decyzji pracownika' },
      access: { update: () => false },
      admin: {
        readOnly: true,
        condition: (data) => carriesPayoutStatus(typeOf(data)),
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'payoutRejectionReason',
      type: 'textarea',
      label: { en: 'Rejection reason', pl: 'Powód odrzucenia' },
      access: { update: () => false },
      admin: { readOnly: true, condition: (data) => carriesPayoutStatus(typeOf(data)) },
    },
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
