import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerField, isAdminOrOwnerOrManager, isManager } from '@/access'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'

/** Managers can only create AUXILIARY registers — force the type. */
const enforceAuxiliaryForManager: CollectionBeforeValidateHook = ({ data, req }) => {
  if (isManager({ req })) return { ...data, type: 'AUXILIARY' }
  return data
}

export const CashRegisters: CollectionConfig = {
  slug: 'cash-registers',
  labels: {
    singular: { en: 'Cash Register', pl: 'Kasa' },
    plural: { en: 'Cash Registers', pl: 'Kasy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'owner', 'balance'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    beforeValidate: [enforceAuxiliaryForManager],
    afterChange: [makeRevalidateAfterChange('cashRegisters')],
    afterDelete: [makeRevalidateAfterDelete('cashRegisters')],
  },
  access: {
    // ADMIN/OWNER: full CRUD. MANAGER: create auxiliary only, read all.
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
    delete: () => false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: { en: 'Name', pl: 'Nazwa' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: { en: 'Owner', pl: 'Właściciel' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'AUXILIARY',
      label: { en: 'Type', pl: 'Typ' },
      options: [
        { label: { en: 'Main', pl: 'Główna' }, value: 'MAIN' },
        { label: { en: 'Auxiliary', pl: 'Pomocnicza' }, value: 'AUXILIARY' },
        { label: { en: 'Virtual', pl: 'Wirtualna' }, value: 'VIRTUAL' },
      ],
      admin: {
        condition: (_, __, { user }) => user?.role === 'ADMIN' || user?.role === 'OWNER',
      },
    },
    {
      name: 'balance',
      type: 'number',
      defaultValue: 0,
      label: { en: 'Balance', pl: 'Saldo' },
      admin: {
        readOnly: true,
        description: {
          en: 'Updated automatically via transactions',
          pl: 'Aktualizowane automatycznie przez transfery',
        },
      },
      access: {
        // Derived field — only writable via raw SQL in recalculation hooks
        update: () => false,
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: { en: 'Active', pl: 'Aktywna' },
      access: {
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
  ],
}
