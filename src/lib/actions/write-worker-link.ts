import 'server-only'
import type { Payload } from 'payload'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import {
  WORKER_LINK_SHARES,
  writeShareToken,
  type WorkerShareKeyT,
} from '@/lib/kosztorys/share-token'
import type { WorkerLinkKindT } from '@/lib/kosztorys/worker-view/types'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

/**
 * Refused while that worker's scope is blocked: the menu disables the item, but a stale menu (an
 * etap's rozliczenie cleared in another tab) must not be able to mint a link whose page could only
 * ever show a notice — the report page shows one instead of the form, and `tokenAction` refuses its send.
 */
export async function writeWorkerLink(
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
