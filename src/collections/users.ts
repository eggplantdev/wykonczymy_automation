import {
  canUpdateUser,
  isAdminOrOwner,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
} from '@/access'
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
import type { CollectionConfig } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { refuseDeleteWhen } from '@/hooks/prevent-delete'
import { guardAccountRemoval } from '@/hooks/users/guard-account-removal'
import { guardDefaultRegister } from '@/hooks/users/guard-default-register'
import { guardUserUpdate } from '@/hooks/users/guard-update'
import { refuseDisabledLogin } from '@/hooks/users/refuse-disabled-login'
import { workerDeleteBlocker } from '@/lib/workers/delete-blocker'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import { LANGUAGES, isLanguage } from '@/lib/i18n/languages'

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
        // Only ADMIN/OWNER can set or change roles
        // MANAGER creating a user → field not writable → defaults to EMPLOYEE
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
      name: 'defaultCashRegister',
      type: 'relationship',
      relationTo: 'cash-registers',
      label: { en: 'Default Cash Register', pl: 'Domyślna kasa' },
    },
    // Closed to access-checked writes: a REST PATCH would skip the use check, the kasy and the
    // session purge that the trash actions (overrideAccess) run.
    {
      name: 'trashedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { hidden: true },
      label: { en: 'Trashed at', pl: 'W koszu od' },
    },
  ],
}
