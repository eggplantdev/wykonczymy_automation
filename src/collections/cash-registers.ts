import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { isAdminOrOwner, isAdminOrOwnerField, isAdminOrOwnerOrManager, isManager } from '@/access'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/collections/hooks/revalidate-collection'
import { refuseDeleteWhen } from '@/collections/hooks/prevent-delete'
import { guardCashRegisterUpdate } from '@/collections/hooks/cash-registers/guard-update'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { REGISTER_TYPES, REGISTER_TYPE_LABELS } from '@/lib/cash-registers/register-types'
import { trashedAtField } from '@/collections/fields/trashed-at'

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
      options: REGISTER_TYPES.map((value) => ({ label: REGISTER_TYPE_LABELS[value], value })),
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
    trashedAtField(),
  ],
}
