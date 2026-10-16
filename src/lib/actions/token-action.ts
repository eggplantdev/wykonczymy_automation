import 'server-only'
import type { Payload } from 'payload'
import { runAuthorizedHandler } from '@/lib/actions/run-action'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { readReportShare } from '@/lib/db/worker-report-share'
import { noticeFailure, type NoticeKeyT } from '@/lib/i18n/notice-failure'
import { reportShareRefusal } from '@/lib/kosztorys/worker-report/share-refusal'
import { REPORT_SCOPE_REFUSAL_NOTICE_KEYS } from '@/lib/kosztorys/worker-view/labels'
import { reportScopeRefusal, resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
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
      const refuse = (key: NoticeKeyT) => noticeFailure(key) as ActionResultT<TData>
      const db = await getDb(payload)

      const share = await readReportShare(db, token)
      if (!share) return refuse('unknownToken')

      const refusal = reportShareRefusal(share)
      if (refusal) return refuse(refusal)

      const tree = await buildKosztorysTree(share.investmentId)
      const scopeRefusal = reportScopeRefusal(resolveWorkerScope(tree.stages, share.workerId))
      if (scopeRefusal) return refuse(REPORT_SCOPE_REFUSAL_NOTICE_KEYS[scopeRefusal])

      const ownItemIds = new Set(
        tree.sections.flatMap((section) => section.items.map((item) => item.id)),
      )
      if (itemIds.some((itemId) => !ownItemIds.has(itemId))) return refuse('foreignItem')

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
