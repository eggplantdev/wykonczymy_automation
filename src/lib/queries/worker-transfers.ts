import type { Where } from 'payload'
import { andWith, buildTransferFilters } from '@/lib/queries/transfer-filters'
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
 * would let `?sourceRegister=<foreign kasa>` replace the scope.
 */
export function buildWorkerTransferWhere(urlFilters: Where, scope: Where): Where {
  return andWith(urlFilters, scope)
}

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
