'use server'

import { protectedAction } from '@/lib/actions/run-action'
import {
  workerReportShare,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import type { ActionResultT } from '@/types/action'

// The menu's click, like the investor's „Udostępnij": a live link is handed back untouched. Minted
// even while the worker's scope is blocked — his own page lists it, and `/z/` shows the notice while
// `tokenAction` refuses the send.
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
