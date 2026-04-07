import type { CollectionConfig } from 'payload'
import { isAdminOrOwner } from '@/access'

export const AmountEdits: CollectionConfig = {
  slug: 'amount-edits',
  labels: {
    singular: { en: 'Amount Edit', pl: 'Zmiana kwoty' },
    plural: { en: 'Amount Edits', pl: 'Zmiany kwot' },
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['transaction', 'previousAmount', 'newAmount', 'editedBy', 'createdAt'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  access: {
    read: isAdminOrOwner,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'transaction',
      type: 'relationship',
      relationTo: 'transactions',
      label: { en: 'Transaction', pl: 'Transakcja' },
      admin: { readOnly: true },
    },
    {
      name: 'previousAmount',
      type: 'number',
      required: true,
      label: { en: 'Previous Amount', pl: 'Poprzednia kwota' },
      admin: { readOnly: true },
    },
    {
      name: 'newAmount',
      type: 'number',
      required: true,
      label: { en: 'New Amount', pl: 'Nowa kwota' },
      admin: { readOnly: true },
    },
    {
      name: 'editedBy',
      type: 'relationship',
      relationTo: 'users',
      label: { en: 'Edited By', pl: 'Zmienione przez' },
      admin: { readOnly: true },
    },
  ],
}
