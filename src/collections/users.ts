import {
  canUpdateUser,
  isAdminOrOwner,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
} from '@/access'
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
import type { CollectionConfig } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/collections/hooks/revalidate-collection'
import { refuseDeleteWhen } from '@/collections/hooks/prevent-delete'
import { guardAccountRemoval } from '@/collections/hooks/users/guard-account-removal'
import { guardDefaultRegister } from '@/collections/hooks/users/guard-default-register'
import { guardUserUpdate } from '@/collections/hooks/users/guard-update'
import { refuseDisabledLogin } from '@/collections/hooks/users/refuse-disabled-login'
import { workerDeleteBlocker } from '@/lib/workers/delete-blocker'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import { LANGUAGES, isLanguage } from '@/lib/i18n/languages'
import { trashedAtField } from '@/collections/fields/trashed-at'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    // 90 days, slid forward on app open (`SessionRefresher`): a worker opens the app once a month.
    tokenExpiration: 7776000,
    cookies: { secure: process.env.NODE_ENV === 'production' },
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
    beforeLogin: [refuseDisabledLogin],
    beforeChange: [guardUserUpdate, guardDefaultRegister],
    beforeDelete: [guardAccountRemoval, refuseDeleteWhen(workerDeleteBlocker)],
    afterChange: [makeRevalidateAfterChange('users')],
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
    delete: isAdminOrOwner,
    admin: isAdminOrOwnerOrManagerBoolean,
    // Payload's default is any session, which would let a held phone reset the lockout that makes
    // `changeOwnCredentialsAction`'s password check worth anything.
    unlock: isAdminOrOwnerOrManagerBoolean,
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
        create: isAdminOrOwnerField,
        update: isAdminOrOwnerField,
      },
    },
    // Text, not a select: a select is a Postgres enum, and every new language would be a migration.
    // Empty = Polish.
    {
      name: 'language',
      type: 'text',
      label: { en: 'Language', pl: 'Język' },
      validate: (value: string | null | undefined) =>
        value == null || value === '' || isLanguage(value) || `Dozwolone: ${LANGUAGES.join(', ')}`,
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
      name: 'phone',
      type: 'text',
      label: { en: 'Phone', pl: 'Telefon' },
    },
    {
      name: 'canAddExpensesWithoutInvestment',
      type: 'checkbox',
      defaultValue: false,
      label: {
        en: 'Can add expenses without an investment',
        pl: 'Zaznacz, jeśli pracownik może dodawać wydatki bez wybranej inwestycji',
      },
    },
    {
      name: 'defaultCashRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Default Cash Register', pl: 'Domyślna kasa' },
    },
    trashedAtField(),
  ],
}
