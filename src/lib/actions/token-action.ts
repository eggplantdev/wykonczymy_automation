import 'server-only'
import type { Payload } from 'payload'
import { runAuthorizedHandler } from '@/lib/actions/run-action'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { investmentGateFor } from '@/lib/db/investment-gate'
import { readReportShare } from '@/lib/db/worker-reports'
import { REPORT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { CACHE_TAGS } from '@/lib/cache/tags'
import type { ActionResultT } from '@/types/action'

export type TokenActionCtxT = {
  payload: Payload
  db: DbExecutorT
  investmentId: number
  workerId: number
  // Read once for the scope check and handed down, so the handler copies opis / j.m. / sekcja from
  // the same instant the gate judged.
  tree: KosztorysTreeT
}

/**
 * The public-surface twin of `protectedAction`: the token in the URL is the whole credential, so
 * everything the handler acts on — investment, worker, tree — comes from the token lookup, never from
 * the client. The lookup is uncached, so a revoke bites on the very next send.
 *
 * `itemIds` are the pozycje the client names; each must belong to the token's investment, or a
 * worker with a valid link could write into another investment's rozpiska.
 */
export async function tokenAction<TData = undefined>(
  label: string,
  { token, itemIds = [] }: { token: string; itemIds?: readonly number[] },
  handler: (ctx: TokenActionCtxT) => Promise<ActionResultT<TData>>,
  revalidate?: (keyof typeof CACHE_TAGS)[],
): Promise<ActionResultT<TData>> {
  return runAuthorizedHandler<TData>(
    label,
    async (payload) => {
      const refuse = (error: string) => ({ success: false, error }) as ActionResultT<TData>
      const db = await getDb(payload)

      const share = await readReportShare(db, token)
      if (!share) return refuse(REPORT_REFUSALS.unknownToken)

      const gate = await investmentGateFor(db, share.investmentId)
      if (gate.lockMessage) return refuse(REPORT_REFUSALS.closed)
      if (gate.isTemplate) return refuse(REPORT_REFUSALS.template)

      if (!share.isWorkerActive) return refuse(REPORT_REFUSALS.inactiveWorker)

      const tree = await buildKosztorysTree(share.investmentId)
      const scope = resolveWorkerScope(tree.stages, share.workerId)
      if (scope.kind === 'blocked') return refuse(WORKER_SCOPE_BLOCK_MESSAGES[scope.reason])

      const ownItemIds = new Set(
        tree.sections.flatMap((section) => section.items.map((item) => item.id)),
      )
      if (itemIds.some((itemId) => !ownItemIds.has(itemId))) {
        return refuse(REPORT_REFUSALS.foreignItem)
      }

      return handler({
        payload,
        db,
        investmentId: share.investmentId,
        workerId: share.workerId,
        tree,
      })
    },
    revalidate,
  )
}
