'use server'

import { workerSchema, type WorkerFormDataT } from '@/components/forms/worker-form/worker-schema'
import { uniqueClash } from '@/lib/trash/unique-holder'
import { accountChangeRefusal, revokeAccountAccess } from '@/lib/workers/account-removal'
import { fetchRemovalSubject } from '@/lib/db/account-removal'
import { getDb } from '@/lib/db/get-db'
import { assignableRoles } from '@/lib/auth/roles'
import { MANAGER_SCOPE_MESSAGE } from '@/lib/constants/worker-lock'
import { validateAction, protectedAction } from './run-action'

export async function createWorkerAction(data: WorkerFormDataT) {
  return protectedAction(
    'createWorkerAction',
    async ({ payload, user }) => {
      const parsed = validateAction(workerSchema, data)
      if (!parsed.success) return parsed
      if (!assignableRoles(user.role).includes(parsed.data.role)) {
        return { success: false, error: MANAGER_SCOPE_MESSAGE }
      }

      const clash = await uniqueClash(payload, {
        collection: 'users',
        field: 'email',
        value: parsed.data.email,
        subject: `Pracownik z adresem ${parsed.data.email}`,
      })
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

      const clash = await uniqueClash(payload, {
        collection: 'users',
        field: 'email',
        value: parsed.data.email,
        ownId: id,
        subject: `Pracownik z adresem ${parsed.data.email}`,
      })
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
