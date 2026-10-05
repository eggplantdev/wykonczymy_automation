'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import {
  deleteShare,
  workerReportShare,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

/**
 * Refused while that worker's scope is blocked: the menu disables the item, but a stale menu (an
 * etap's rozliczenie cleared in another tab) must not be able to mint a link whose page could only
 * ever show a notice — the report page shows one instead of the form, and `tokenAction` refuses its send.
 */
async function writeWorkerLink(
  payload: Payload,
  key: WorkerShareKeyT,
  { rotate }: { rotate: boolean },
): Promise<ActionResultT<string>> {
  const tree = await buildKosztorysTree(key.investmentId)
  const scope = resolveWorkerScope(tree.stages, key.workerId)
  if (scope.kind === 'blocked') {
    return { success: false, error: WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] }
  }
  return writeShareToken(payload, workerReportShare(key), { rotate })
}

// The menu's click, like the investor's „Udostępnij": a live link is handed back untouched.
export async function ensureWorkerLinkAction(key: WorkerShareKeyT): Promise<ActionResultT<string>> {
  return protectedAction<string>('ensureWorkerLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, { rotate: false }),
  )
}

export async function generateWorkerLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, { rotate: true }),
  )
}

export async function revokeWorkerLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerLinkAction', async ({ payload }) => {
    await deleteShare(payload, workerReportShare(key))
    return { success: true }
  })
}
