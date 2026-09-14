import {
  canUpdateUser,
  isAdminOrOwner,
  isAdminOrOwnerOrManagerBoolean,
  isAdminOrOwnerField,
  isAdminOrOwnerOrManager,
} from '@/access'
import { forgotPasswordEmailHTML } from '@/lib/email/forgot-password-template'
import type { CollectionConfig, Where } from 'payload'
import { makeRevalidateAfterChange, makeRevalidateAfterDelete } from '@/hooks/revalidate-collection'
import { excludingCancelled, makePreventDelete } from '@/hooks/prevent-delete'
import { ROLES, ROLE_LABELS } from '@/lib/auth/roles'

// Block a hard delete while a FIGURE or its audit trail still names this person: a wypłata whose
// recipient is unknown, an amount edit with no editor, an etap with no podwykonawca. Deactivation
// (`active`) is the intended way for someone to leave; it keeps the row, so every past figure still
// says who it was about.
// Plain authorship is deliberately NOT a blocker — a media uploader, a snapshot's `takenBy`, a
// preset's `createdBy` name who touched something, not what a złotówka means, and blocking on them
// would freeze an account after one upload.
const preventDeleteWithReferences = makePreventDelete({
  probes: [
    {
      collection: 'transactions',
      // Cancelled rows are exempt — see `excludingCancelled`. The other three probes have no such
      // notion, and `cash-registers.owner_id` is NOT NULL, so anyone holding a kasa stays blocked.
      // Authorship is exempted with the rest, not just `worker`: the delete is what erases the name,
      // so refusing it over a cancelled row's `createdBy` preserves no identity — it only makes the
      // account undeletable. A cancelled row's „Utworzone przez" going empty is the cost, and it is
      // the same cost the row's live siblings would impose by blocking the delete outright.
      where: (id): Where =>
        excludingCancelled({
          or: [
            { worker: { equals: id } },
            { createdBy: { equals: id } },
            { updatedBy: { equals: id } },
          ],
        }),
      label: 'transakcje',
    },
    {
      collection: 'amount-edits',
      where: (id) => ({ editedBy: { equals: id } }),
      label: 'zmiany kwot',
    },
    // The only NOT NULL FK of the four: without this probe the delete fails anyway, but with a raw
    // 23502 instead of a sentence naming the kasa.
    {
      collection: 'cash-registers',
      where: (id) => ({ owner: { equals: id } }),
      label: 'kasy',
    },
    {
      collection: 'kosztorys-stages',
      where: (id) => ({ worker: { equals: id } }),
      label: 'etapy kosztorysu',
    },
    // Not authorship: this names who was HOLDING a tool. Deleting the row would erase the only
    // answer to „who had it last" for anything still in that person's hands.
    {
      collection: 'equipment-events',
      where: (id) => ({ holder: { equals: id } }),
      label: 'sprzęt',
    },
  ],
  message: (blockers) =>
    `Nie można usunąć pracownika — jest powiązany z danymi (${blockers.join(', ')}). Zamiast usuwać, odznacz „Aktywny".`,
})

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
    beforeDelete: [preventDeleteWithReferences],
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
    },
  ],
}
