'use server'

import { protectedAction } from '@/lib/actions/run-action'
import {
  workerReportShare,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import type { ActionResultT } from '@/types/action'

export async function ensureWorkerLinkAction(key: WorkerShareKeyT): Promise<ActionResultT<string>> {
  return protectedAction<string>('ensureWorkerLinkAction', ({ payload }) =>
    writeShareToken(payload, workerReportShare(key), { rotate: false }),
  )
}

export async function generateWorkerLinkAction(
  key: WorkerShareKeyT,
): Promise<ActionResultT<string>> {
  return protectedAction<string>('generateWorkerLinkAction', ({ payload }) =>
    writeShareToken(payload, workerReportShare(key), { rotate: true }),
  )
}
