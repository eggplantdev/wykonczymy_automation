import {
  isAdminOrOwner,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
} from '@/access'
import type { CollectionConfig } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 86400, // 24 hours until app logs you out
  },
  hooks: {
    afterChange: [makeRevalidateAfterChange('users')],
    afterDelete: [makeRevalidateAfterDelete('users')],
  },
  labels: {
    singular: { en: 'User', pl: 'Użytkownik' },
    plural: { en: 'Users', pl: 'Użytkownicy' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: { en: 'Admin', pl: 'Administracja' },
  },
  access: {
    read: isAdminOrOwnerOrManager,
    create: isAdminOrOwnerOrManager,
    update: isAdminOrOwner,
    delete: isAdminOrOwner,
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
  ],
}
