'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { writeWorkerLink } from '@/lib/actions/write-worker-link'
import { deleteShare, workerShare, type WorkerShareKeyT } from '@/lib/kosztorys/share-token'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import type { ActionResultT } from '@/types/action'

// The menu's click, like the investor's „Udostępnij": a live link is handed back untouched.
export async function ensureWorkerLinkAction(
  key: WorkerShareKeyT,
  kind: WorkerLinkKindT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('ensureWorkerLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, kind, { rotate: false }),
  )
}

export async function generateWorkerShareLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerShareLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, 'rozpiska', { rotate: true }),
  )
}

export async function revokeWorkerShareLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerShareLinkAction', async ({ payload }) => {
    await deleteShare(payload, workerShare(key))
    return { success: true }
  })
}
