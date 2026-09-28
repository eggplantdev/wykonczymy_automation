'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import {
  deleteShare,
  workerShare,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

/**
 * Refused while that worker's scope is blocked: the menu disables
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
    return writeShareToken(payload, workerShare(key), { rotate: true })
  })
}

export async function revokeWorkerShareLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerShareLinkAction', async ({ payload }) => {
    await deleteShare(payload, workerShare(key))
    return { success: true }
  })
}
