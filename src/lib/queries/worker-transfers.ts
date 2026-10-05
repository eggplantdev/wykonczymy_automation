import type { Where } from 'payload'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import type { ResolvedSearchParamsT } from '@/types/page'

export function workerTransferScope(workerId: number, registerIds: number[]): Where {
  // `in: []` renders `IN ()`, a Postgres syntax error — a worker without kasy has no kasa branches.
  const registerBranches: Where[] =
    registerIds.length > 0
      ? [{ sourceRegister: { in: registerIds } }, { targetRegister: { in: registerIds } }]
      : []
  return { or: [{ worker: { equals: workerId } }, ...registerBranches] }
}

/**
 * The scope goes under `and`, never spread: the kasa filter writes `where.or` too, so a spread
 * would let `?sourceRegister=<foreign kasa>` replace the scope. The URL filters stay top-level
 * because the readers of a transfer Where (cancelled strip, `listsCancelled`, the no-results
 * sentinel) look only there.
 */
export function buildWorkerTransferWhere(urlFilters: Where, scope: Where): Where {
  return { ...urlFilters, and: [scope] }
}

/** The worker page's access boundary — the screen and its Faktury / Drukuj channel must read one. */
export function workerPageTransferWhere(
  searchParams: ResolvedSearchParamsT,
  viewerId: number,
  workerId: number,
  registerIds: number[],
): Where {
  return buildWorkerTransferWhere(
    buildTransferFilters(searchParams, { id: viewerId }),
    workerTransferScope(workerId, registerIds),
  )
}
