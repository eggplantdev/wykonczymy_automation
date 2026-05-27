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
    {
      name: 'googleSheetId',
      type: 'text',
      // One sheet per investment: two investments sharing a tab would each treat the
      // other's rows as orphans and delete them on sync (review T1.3). Postgres allows
      // multiple NULLs under a unique index, so unlinked investments are unaffected.
      unique: true,
      label: { en: 'Google Sheet ID', pl: 'ID arkusza Google' },
      admin: {
        description: {
          en: 'Long string between /d/ and /edit in the sheet URL. Used to embed the kosztorys and to sync transfers via Sheets API. Auto-set on investment create; can be pasted manually for investments created before that feature shipped.',
          pl: 'Długi ciąg pomiędzy /d/ a /edit w URL arkusza. Używane do osadzenia kosztorysu i synchronizacji transakcji przez Sheets API. Ustawiane automatycznie przy tworzeniu inwestycji; można wkleić ręcznie dla inwestycji utworzonych zanim ta funkcja powstała.',
        },
      },
    },
  ],
}
