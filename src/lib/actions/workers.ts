'use server'

import type { Payload } from 'payload'
import { workerSchema, type WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'
import { findEmailHolder } from '@/lib/workers/find-email-holder'
import { accountChangeRefusal, revokeAccountAccess } from '@/lib/workers/account-removal'
import { fetchRemovalSubject } from '@/lib/db/account-removal'
import { getDb } from '@/lib/db/get-db'
import { assignableRoles } from '@/lib/auth/roles'
import { MANAGER_SCOPE_MESSAGE } from '@/lib/constants/worker-lock'
import { validateAction, protectedAction } from './run-action'

// A trashed worker still holds his e-mail, so the refusal has to say where to find him — otherwise
// the owner is told the e-mail is taken by a worker no listing shows.
async function emailClash(payload: Payload, email: string, ownId?: number) {
  if (!email) return undefined
  const holder = await findEmailHolder(payload, email, ownId)
  if (!holder) return undefined
  return holder.trashedAt
    ? `Pracownik z adresem ${email} jest w Koszu — przywróć go stamtąd.`
    : `Pracownik z adresem ${email} już istnieje.`
}

export async function createWorkerAction(data: WorkerFormDataT) {
  return protectedAction(
    'createWorkerAction',
    async ({ payload, user }) => {
      const parsed = validateAction(workerSchema, data)
      if (!parsed.success) return parsed
      if (!assignableRoles(user.role).includes(parsed.data.role)) {
        return { success: false, error: MANAGER_SCOPE_MESSAGE }
      }

      const clash = await emailClash(payload, parsed.data.email)
      if (clash) return { success: false, error: clash }

      await payload.create({
        collection: 'users',
        data: {
          ...parsed.data,
          password: crypto.randomUUID(),
        },
      })

      return { success: true }
    },
    ['users'],
  )
}

export async function updateWorkerAction(id: number, data: WorkerFormDataT) {
  return protectedAction(
    'updateWorkerAction',
    async ({ payload, user }) => {
      const parsed = validateAction(workerSchema, data)
      if (!parsed.success) return parsed

      const db = await getDb(payload)
      const subject = await fetchRemovalSubject(db, id)
      const refusal =
        subject &&
        accountChangeRefusal(subject, {
          actorRole: user.role,
          isSelf: user.id === id,
          next: parsed.data,
        })
      if (refusal) return { success: false, error: refusal }

      const clash = await emailClash(payload, parsed.data.email, id)
      if (clash) return { success: false, error: clash }

      await payload.update({
        collection: 'users',
        id,
        data: parsed.data,
      })
      if (!parsed.data.active) await revokeAccountAccess(db, id)

      return { success: true }
    },
    ['users'],
  )
}
