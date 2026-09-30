'use server'

import type { Payload } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import {
  deleteShare,
  WORKER_LINK_SHARES,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
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
  kind: WorkerLinkKindT,
  { rotate }: { rotate: boolean },
): Promise<ActionResultT<string>> {
  const tree = await buildKosztorysTree(key.investmentId)
  const scope = resolveWorkerScope(tree.stages, key.workerId)
  if (scope.kind === 'blocked') {
    return { success: false, error: WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] }
  }
  return writeShareToken(payload, WORKER_LINK_SHARES[kind](key), { rotate })
}

// The menu's click, like the investor's „Udostępnij": a live link is handed back untouched.
export async function ensureWorkerLinkAction(
  key: WorkerShareKeyT,
  kind: WorkerLinkKindT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('ensureWorkerLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, kind, { rotate: false }),
  )
}

export async function generateWorkerLinkAction(
  key: WorkerShareKeyT,
  kind: WorkerLinkKindT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, kind, { rotate: true }),
  )
}

export async function revokeWorkerLinkAction(
  key: WorkerShareKeyT,
  kind: WorkerLinkKindT,
): Promise<ActionResultT> {
  return protectedAction('revokeWorkerLinkAction', async ({ payload }) => {
    await deleteShare(payload, WORKER_LINK_SHARES[kind](key))
    return { success: true }
  })
}
