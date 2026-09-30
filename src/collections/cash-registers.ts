import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerField, isAdminOrOwnerOrManager, isManager } from '@/access'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { refuseDeleteWhen } from '@/hooks/prevent-delete'
import { guardCashRegisterUpdate } from '@/hooks/cash-registers/guard-update'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'

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
    defaultColumns: ['name', 'owner', 'type'],
    group: { en: 'Finance', pl: 'Finanse' },
  },
  hooks: {
    beforeValidate: [enforceAuxiliaryForManager],
    beforeChange: [guardCashRegisterUpdate],
    beforeDelete: [refuseDeleteWhen(cashRegisterDeleteBlocker)],
    afterChange: [makeRevalidateAfterChange('cashRegisters')],
    afterDelete: [makeRevalidateAfterDelete('cashRegisters')],
  },
  access: {
    // ADMIN/OWNER: full CRUD. MANAGER: create auxiliary only, read all.
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
        { label: { en: 'Worker', pl: 'Pracownicza' }, value: 'WORKER' },
      ],
      admin: {
        condition: (_, __, { user }) => !!user?.role && isAdminOrOwnerRole(user.role),
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
    // Set by the trash actions only (src/lib/actions/cash-register-trash.ts).
    {
      name: 'trashedAt',
      type: 'date',
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
  ],
}
