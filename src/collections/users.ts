import {
  canUpdateUser,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
  isAdminOrOwnerOrSelf,
} from '@/access'
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'

const autoCreateWorkerRegister: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
  operation,
}) => {
  const isNewEmployee =
    (operation === 'create' && doc.role === 'EMPLOYEE') ||
    (operation === 'update' && doc.role === 'EMPLOYEE' && previousDoc?.role !== 'EMPLOYEE')

  if (!isNewEmployee) return doc

  const existing = await req.payload.find({
    collection: 'cash-registers',
    where: {
      owner: { equals: doc.id },
      type: { equals: 'WORKER' },
    },
    limit: 1,
  })

  if (existing.docs.length > 0) return doc

  await req.payload.create({
    collection: 'cash-registers',
    data: {
      name: `Kasa - ${doc.name}`,
      owner: doc.id,
      type: 'WORKER',
      active: true,
    },
  })

  return doc
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 604800, // 7 days until app logs you out
    forgotPassword: {
      generateEmailHTML: (args) => {
        return forgotPasswordEmailHTML({
          token: args?.token ?? '',
          userName: (args?.user as { name?: string })?.name,
        })
      },
      generateEmailSubject: () => 'Resetowanie hasła — Wykonczymy',
    },
  },
  hooks: {
    afterChange: [autoCreateWorkerRegister, makeRevalidateAfterChange('users')],
    afterDelete: [makeRevalidateAfterDelete('users')],
  },
  labels: {
    singular: { en: 'Employee', pl: 'Pracownik' },
    plural: { en: 'Employees', pl: 'Pracownicy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: { en: 'Admin', pl: 'Administracja' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: canUpdateUser,
    delete: isAdminOrOwnerOrSelf,
    admin: isAdminOrOwnerOrManagerBoolean,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      saveToJWT: true,
      label: { en: 'Name', pl: 'Imię i nazwisko' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'EMPLOYEE',
      label: { en: 'Role', pl: 'Rola' },
      options: ROLES.map((role) => ({
        label: ROLE_LABELS[role],
        value: role,
      })),
      saveToJWT: true,
      access: {
        // Only ADMIN/OWNER can set or change roles
        // MANAGER creating a user → field not writable → defaults to EMPLOYEE
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: { en: 'Active', pl: 'Aktywny' },
      access: {
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
    {
      name: 'defaultCashRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Default Cash Register', pl: 'Domyślna kasa' },
      admin: {
        description:
          'Jeśli tworzysz pracownika i nie wybierzesz domyślnej kasy, zostanie ona utworzona automatycznie.',
      },
    },
  ],
}
