import 'server-only'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { computeWorkerSummary } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerAudienceT, WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { getWorkerViewSettings } from '@/lib/queries/kosztorys-worker-view'
import { fetchPayoutTransactionsForInvestment } from '@/lib/queries/investment-transactions'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ReportShareT } from '@/lib/db/worker-report-share'

// The cached half: everything but the settings, which are attached per request below.
type WorkerKosztorysCoreT =
  | (Omit<Extract<WorkerKosztorysT, { kind: 'ready' }>, 'worker'> & {
      worker: Omit<WorkerAudienceT, 'settings'>
    })
  | Extract<WorkerKosztorysT, { kind: 'blocked' }>

const WORKER_KOSZTORYS_TAGS = [
  CACHE_TAGS.kosztorysSections,
  CACHE_TAGS.kosztorysItems,
  CACHE_TAGS.kosztorysStages,
  CACHE_TAGS.stageProgress,
  CACHE_TAGS.investments,
  CACHE_TAGS.transfers,
  // The worker's name is baked into the entry.
  CACHE_TAGS.users,
]

/**
 * The one projection the link, the owner's Podgląd and the PDF all render, so the three cannot
 * drift. Unexported and authorization-free, like the investor's builder: the only ways in are the
 * guarded entrances below.
 *
 * Scoping happens here, on data: the tree leaves with the worker's etapy only, so the grid's sums,
 * the empty-rows rule and the summary are his by construction rather than by a render flag someone
 * can forget. A blocked scope leaves with its reason and no tree — a page that cannot price the
 * work must not be handed the prices.
 */
async function buildWorkerKosztorysData(
  investmentId: number,
  workerId: number,
): Promise<WorkerKosztorysCoreT | null> {
  const payload = await getPayload({ config })
  const [tree, investment, workers, payoutRows] = await Promise.all([
    buildKosztorysTree(investmentId),
    payload.findByID({ collection: 'investments', id: investmentId, depth: 0 }),
    payload.find({
      collection: 'users',
      where: { id: { equals: workerId } },
      select: { name: true },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    }),
    fetchPayoutTransactionsForInvestment(investmentId),
  ])
  const worker = workers.docs[0]
  if (!worker) return null

  const scope = resolveWorkerScope(tree.stages, workerId)
  if (scope.kind === 'blocked') {
    return {
      kind: 'blocked',
      reason: scope.reason,
      investmentName: investment.name,
      workerName: worker.name,
    }
  }

  const executedQtyByItem: Record<number, number> = {}
  for (const progress of tree.progress) {
    executedQtyByItem[progress.itemId] =
      (executedQtyByItem[progress.itemId] ?? 0) + progress.qtyDone
  }

  const ownStageIds = new Set(scope.stages.map((stage) => stage.id))
  const workerTree = {
    ...tree,
    stages: scope.stages,
    progress: tree.progress.filter((progress) => ownStageIds.has(progress.stageId)),
  }

  return {
    kind: 'ready',
    investmentId,
    investmentName: investment.name,
    tree: workerTree,
    worker: {
      workerId,
      name: worker.name,
      plane: scope.plane,
      summary: computeWorkerSummary({
        rows: treeToRows(workerTree),
        stages: scope.stages,
        plane: scope.plane,
        workerId,
        payoutRows,
      }),
      executedQtyByItem,
    },
  }
}

// The guard cannot live inside: `requireAuth` reads cookies, which throws inside unstable_cache.
const cachedWorkerKosztorysData = unstable_cache(
  buildWorkerKosztorysData,
  ['worker-kosztorys-data-v2'],
  { tags: WORKER_KOSZTORYS_TAGS },
)

async function withWorkerSettings(
  investmentId: number,
  workerId: number,
): Promise<WorkerKosztorysT | null> {
  const [core, settings] = await Promise.all([
    cachedWorkerKosztorysData(investmentId, workerId),
    getWorkerViewSettings(),
  ])
  if (!core || core.kind === 'blocked') return core
  return { ...core, worker: { ...core.worker, settings } }
}

/**
 * The public worker link: token in, that worker's projection out, no session. An unknown, revoked
 * or empty token is null and the route 404s. The lookup stays uncached so a revoke bites on the next
 * request. It reads `kosztorys-worker-shares` only — an investor token cannot resolve here, and a
 * worker token cannot resolve through `getPreviewKosztorysByToken`, because the tables are separate.
 */
export async function getWorkerKosztorysByToken(token: string): Promise<WorkerKosztorysT | null> {
  if (!token) return null
  const payload = await getPayload({ config })
  const shares = await payload.find({
    collection: 'kosztorys-worker-shares',
    where: { token: { equals: token }, 'investment.trashedAt': { exists: false } },
    depth: 0,
    limit: 1,
    pagination: false,
    // This read IS the token check, so it runs beneath the management-only collection access.
    overrideAccess: true,
  })
  const share = shares.docs[0]
  if (!share) return null

  const investmentId =
    typeof share.investment === 'object' ? share.investment.id : Number(share.investment)
  const workerId = typeof share.worker === 'object' ? share.worker.id : Number(share.worker)
  return withWorkerSettings(investmentId, workerId)
}

/**
 * The report link's projection, for a share the caller already read by its token. Not filtered by
 * trash — the report page explains a closed investment instead of 404ing.
 */
export async function getWorkerKosztorysByReportShare(
  share: ReportShareT,
): Promise<WorkerKosztorysT | null> {
  return withWorkerSettings(share.investmentId, share.workerId)
}

export async function getWorkerKosztorysPreview(
  investmentId: number,
  workerId: number,
): Promise<WorkerKosztorysT | null> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)

  return withWorkerSettings(investmentId, workerId)
}
