'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { writeWorkerLink } from '@/lib/actions/write-worker-link'
import { deleteShare, workerReportShare, type WorkerShareKeyT } from '@/lib/kosztorys/share-token'
import type { ActionResultT } from '@/types/action'

export async function generateWorkerReportLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerReportLinkAction', ({ payload }) =>
    writeWorkerLink(payload, key, 'report', { rotate: true }),
  )
}

export async function revokeWorkerReportLinkAction(key: WorkerShareKeyT): Promise<ActionResultT> {
  return protectedAction('revokeWorkerReportLinkAction', async ({ payload }) => {
    await deleteShare(payload, workerReportShare(key))
    return { success: true }
  })
}
