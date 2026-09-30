'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import {
  deleteShare,
  workerReportShare,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

// Refused under the same blocked scope as the rozpiska link: the report page shows a notice instead
// of the form there, and `tokenAction` refuses its send.
export async function generateWorkerReportLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerReportLinkAction', async ({ payload }) => {
    const tree = await buildKosztorysTree(key.investmentId)
    const scope = resolveWorkerScope(tree.stages, key.workerId)
    if (scope.kind === 'blocked') {
      return { success: false, error: WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] }
    }
    return writeShareToken(payload, workerReportShare(key), { rotate: true })
  })
}

export async function revokeWorkerReportLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerReportLinkAction', async ({ payload }) => {
    await deleteShare(payload, workerReportShare(key))
    return { success: true }
  })
}
