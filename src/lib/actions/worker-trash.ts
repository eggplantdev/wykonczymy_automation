'use server'

import type { Payload, PayloadRequest } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { WORKER_DELETE_TAGS, WORKER_TRASH_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { accountRemovalRefusal } from '@/lib/workers/account-removal'
import { deleteTrashedWorker } from '@/lib/workers/delete-worker-forever'
import { restoreWorker } from '@/lib/workers/restore-worker'
import { trashWorker } from '@/lib/workers/trash-worker'
import type { User } from '@/payload-types'
import type { ActionResultT } from '@/types/action'
import type { SessionUserT } from '@/types/auth'

const MISSING_MESSAGE = 'Pracownik nie istnieje.'

const CONFIRM_NAME_MISMATCH_MESSAGE = 'Wpisana nazwa nie zgadza się z nazwą pracownika.'

// The caller expires the tags itself, through the wrapper — the hooks' own revalidation would
// fire once per write and inside the transaction.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

/**
 * The worker, or `undefined` when this user may not act on him. A MANAGER manages EMPLOYEE accounts
 * only, so anyone above answers as missing rather than as forbidden — like a MAIN kasa for a MANAGER.
 */
async function findManageableWorker(
  payload: Payload,
  user: SessionUserT,
  workerId: number,
  req?: PayloadRequest,
): Promise<User | undefined> {
  const worker = await payload.findByID({
    collection: 'users',
    id: workerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!worker) return undefined
  if (user.role === 'MANAGER' && worker.role !== 'EMPLOYEE') return undefined
  return worker
}

export async function trashWorkerAction(workerId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashWorkerAction',
    async ({ payload, user }) =>
      withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const worker = await findManageableWorker(payload, user, workerId, req)
          if (!worker) return { success: false, error: MISSING_MESSAGE }
          if (worker.trashedAt) return { success: true }

          const refusal =
            (await accountRemovalRefusal(await getDb(payload, req), {
              targetId: workerId,
              actorId: user.id,
            })) ?? (await trashWorker(payload, workerId, req))
          return refusal ? { success: false, error: refusal } : { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      ),
    [...WORKER_TRASH_TAGS],
  )
}

export async function restoreWorkerAction(workerId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreWorkerAction',
    async ({ payload, user }) =>
      withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const worker = await findManageableWorker(payload, user, workerId, req)
          if (!worker) return { success: false, error: MISSING_MESSAGE }
          if (!worker.trashedAt) return { success: true }

          await restoreWorker(payload, workerId, req)
          return { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      ),
    [...WORKER_TRASH_TAGS],
  )
}

export async function deleteWorkerForeverAction(
  workerId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteWorkerForeverAction',
    async ({ payload, user }) => {
      const worker = await findManageableWorker(payload, user, workerId)
      if (!worker) return { success: false, error: MISSING_MESSAGE }
      if (confirmName.trim() !== worker.name.trim()) {
        return { success: false, error: CONFIRM_NAME_MISMATCH_MESSAGE }
      }

      const refusal = await accountRemovalRefusal(await getDb(payload), {
        targetId: workerId,
        actorId: user.id,
      })
      if (refusal) return { success: false, error: refusal }

      const result = await deleteTrashedWorker(payload, workerId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...WORKER_DELETE_TAGS],
  )
}
