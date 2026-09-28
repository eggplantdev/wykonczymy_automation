'use server'

import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/constants'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

// Same entropy as the investor link (kosztorys-share.ts): the token is the whole credential.
const TOKEN_BYTES = 24

type WorkerShareKeyT = { investmentId: number; workerId: number }

async function findWorkerShare(payload: Payload, { investmentId, workerId }: WorkerShareKeyT) {
  const shares = await payload.find({
    collection: 'kosztorys-worker-shares',
    where: { investment: { equals: investmentId }, worker: { equals: workerId } },
    depth: 0,
    limit: 1,
  })
  return shares.docs[0] ?? null
}

export async function getWorkerShareLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string | null>> {
  return protectedAction<string | null>('getWorkerShareLinkAction', async ({ payload }) => {
    const share = await findWorkerShare(payload, key)
    return { success: true, data: share?.token ?? null }
  })
}

/**
 * Mint or rotate one worker's link. Refused while that worker's scope is blocked: the menu disables
 * the button, but a stale menu (an etap's rozliczenie cleared in another tab) must not be able to
 * mint a link whose page could only ever show a notice.
 */
export async function generateWorkerShareLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerShareLinkAction', async ({ payload }) => {
    const tree = await buildKosztorysTree(key.investmentId)
    const scope = resolveWorkerScope(tree.stages, key.workerId)
    if (scope.kind === 'blocked') {
      return { success: false, error: WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] }
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url')
    const share = await findWorkerShare(payload, key)
    if (share) {
      await payload.update({ collection: 'kosztorys-worker-shares', id: share.id, data: { token } })
      return { success: true, data: token }
    }

    try {
      await payload.create({
        collection: 'kosztorys-worker-shares',
        data: { investment: key.investmentId, worker: key.workerId, token },
      })
    } catch {
      // find-then-create is not atomic and the pair is unique — two clicks at once race here. The
      // loser re-reads: by then a link demonstrably exists, which is all the caller wanted.
      const existing = await findWorkerShare(payload, key)
      if (!existing) return { success: false, error: 'Nie udało się wygenerować linku' }
      return { success: true, data: existing.token }
    }
    return { success: true, data: token }
  })
}

export async function revokeWorkerShareLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerShareLinkAction', async ({ payload }) => {
    const share = await findWorkerShare(payload, key)
    if (share) await payload.delete({ collection: 'kosztorys-worker-shares', id: share.id })
    return { success: true }
  })
}
