'use server'

import type { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { lockInvestmentGates } from '@/lib/db/investment-gate'
import { bumpInvestmentRevision } from '@/lib/db/investment-revision'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { addStageProgress } from '@/lib/db/stage-progress'
import { insertWorkerStage } from '@/lib/db/stage-split'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import {
  clearLinesAcceptance,
  readWorkerReport,
  setLinesRejected,
  setPendingExtraItem,
  settleReport,
  updateReportLines,
  type ReportLineDecisionT,
  type WorkerReportLineRowT,
} from '@/lib/db/worker-reports'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { ACCEPT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { acceptSchema } from '@/lib/kosztorys/worker-report/schemas'
import type { AcceptReportInputT, AcceptReportResultT } from '@/lib/kosztorys/worker-report/types'
import { isStageMember, resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { round6 } from '@/lib/utils/round'
import type { ActionResultT } from '@/types/action'

// Thrown inside the transaction so everything it already wrote rolls back.
class AcceptRefusal extends Error {}

const STALE = 'Zgłoszenie zmieniło się w innym oknie — odśwież je.'

export async function acceptWorkerReportAction(
  input: AcceptReportInputT,
): Promise<ActionResultT<AcceptReportResultT>> {
  return investmentAction<AcceptReportResultT>(
    'acceptWorkerReportAction',
    { investmentId: input.investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(acceptSchema, input)
      if (!parsed.success) return parsed
      const request = parsed.data

      try {
        return await withPayloadTransaction(
          payload,
          async (req) => {
            const tx = await getDb(payload, req)
            const data = await acceptInTransaction(tx, request, user.id)
            return { success: true as const, data }
          },
          { skipRevalidation: true },
        )
      } catch (error) {
        if (error instanceof AcceptRefusal) return { success: false, error: error.message }
        throw error
      }
    },
    // Expired on a save that only odrzuca lines too: the report queue is an uncached read, and these
    // tags are what re-render it — narrowed, a rejected report keeps showing as pending.
    ['kosztorysStages', 'stageProgress', 'kosztorysItems', 'investments'],
  )
}

export async function pointReportLineAction(
  investmentId: number,
  lineId: number,
  itemId: number | undefined,
): Promise<ActionResultT> {
  return investmentAction('pointReportLineAction', { investmentId }, async ({ payload }) => {
    const db = await getDb(payload)
    const isWritten = await setPendingExtraItem(db, investmentId, lineId, itemId ?? null)
    return isWritten ? { success: true } : { success: false, error: STALE }
  })
}

async function acceptInTransaction(
  tx: DbExecutorT,
  request: z.infer<typeof acceptSchema>,
  userId: number,
): Promise<AcceptReportResultT> {
  const { investmentId, reportId } = request
  // Re-gated under the row lock: the gate `investmentAction` ran is a read another request can
  // overtake before this transaction starts.
  const gate = (await lockInvestmentGates(tx, [investmentId])).get(investmentId)
  if (!gate) throw new AcceptRefusal('Inwestycja nie istnieje.')
  if (gate.lockMessage) throw new AcceptRefusal(gate.lockMessage)

  const report = await readWorkerReport(tx, investmentId, reportId)
  if (!report) throw new AcceptRefusal('Zgłoszenie nie istnieje.')
  const { workerId } = report.report

  const lineById = new Map(report.lines.map((line) => [line.id, line]))
  const acceptedIds = request.lines.map((decision) => decision.lineId)
  const decidedIds = [...acceptedIds, ...request.undone]
  const flaggedIds = [...request.rejected, ...request.unrejected]
  if (
    new Set(decidedIds).size !== decidedIds.length ||
    new Set(flaggedIds).size !== flaggedIds.length ||
    flaggedIds.some((lineId) => acceptedIds.includes(lineId))
  ) {
    throw new AcceptRefusal('Pozycja zgłoszenia powtarza się w decyzji.')
  }
  if ([...decidedIds, ...flaggedIds].some((lineId) => !lineById.has(lineId))) {
    throw new AcceptRefusal('Część pozycji nie należy do tego zgłoszenia.')
  }
  const isAccepted = (lineId: number) => lineById.get(lineId)?.acceptedQty !== null
  const isRejected = (lineId: number) => lineById.get(lineId)?.isRejected === true
  const isStale =
    request.lines.some(
      (decision) => decision.seenQty !== (lineById.get(decision.lineId)?.acceptedQty ?? undefined),
    ) || request.rejected.some((lineId) => isAccepted(lineId) && !request.undone.includes(lineId))
  if (isStale) throw new AcceptRefusal(STALE)
  const freshLines = request.lines.filter((decision) => !isAccepted(decision.lineId))
  const changedLines = request.lines.filter((decision) => isAccepted(decision.lineId))
  const undoneIds = request.undone.filter(isAccepted)
  const rejectedIds = request.rejected.filter((lineId) => !isRejected(lineId))
  const unrejectedIds = request.unrejected.filter(isRejected)
  const isFlagging = rejectedIds.length + unrejectedIds.length > 0

  // Odrzucenie touches only the report: no rozpiska read while the investment row lock is held, and
  // no revision bump that would tell another open editor its kosztorys changed.
  if (decidedIds.length === 0) {
    if (!isFlagging) throw new AcceptRefusal(STALE)
    await setLinesRejected(tx, reportId, rejectedIds, true)
    await setLinesRejected(tx, reportId, unrejectedIds, false)
    await settleReport(tx, reportId, userId, undefined)
    return { stage: undefined, cells: [], revision: undefined }
  }

  const tree = await selectKosztorysTreeData(tx, investmentId)
  if (!tree) throw new AcceptRefusal('Zgłoszenie nie istnieje.')
  const isAdding = freshLines.length > 0

  const recordedStageId = report.report.targetStageId
  const recordedStage = tree.stages.find((stage) => stage.id === recordedStageId)
  const staysAccepted = report.lines.some(
    (line) => line.acceptedQty !== null && !undoneIds.includes(line.id),
  )
  if (isAdding && staysAccepted) {
    if (!isStageMember(recordedStage, workerId)) {
      throw new AcceptRefusal(ACCEPT_REFUSALS.lostRecordedStage)
    }
    if (request.target.kind !== 'stage' || request.target.stageId !== recordedStageId) {
      throw new AcceptRefusal('Reszta zgłoszenia trafia do etapu, do którego już je dodano.')
    }
  }

  const itemIds = new Set(tree.items.map((item) => item.id))
  const rozpiskaLines = freshLines.map((decision) => {
    const line = lineById.get(decision.lineId) as WorkerReportLineRowT
    const itemId = decision.itemId ?? line.itemId
    if (itemId === null || !itemIds.has(itemId)) {
      throw new AcceptRefusal(
        `„${line.description}” — wybierz pozycję z rozpiski albo przenieś ją do prac spoza rozpiski.`,
      )
    }
    return { decision, itemId }
  })

  const acceptedItemOf = (line: WorkerReportLineRowT) => line.createdItemId ?? line.itemId
  const changes = changedLines.flatMap((decision) => {
    const line = lineById.get(decision.lineId) as WorkerReportLineRowT
    const delta = round6(decision.acceptedQty - (line.acceptedQty as number))
    if (delta === 0) return []
    const itemId = acceptedItemOf(line)
    if (!recordedStage) {
      throw new AcceptRefusal(
        `„${line.description}” — etap, do którego ją dodano, został usunięty. Przyjętej ilości nie da się już zmienić.`,
      )
    }
    if (itemId === null || !itemIds.has(itemId)) {
      throw new AcceptRefusal(`„${line.description}” — tej pozycji nie ma już w rozpisce.`)
    }
    return [{ itemId, delta }]
  })
  const removals = undoneIds.flatMap((lineId) => {
    const line = lineById.get(lineId) as WorkerReportLineRowT
    const itemId = acceptedItemOf(line)
    if (!recordedStage || itemId === null || !itemIds.has(itemId)) return []
    return [{ itemId, delta: -(line.acceptedQty as number) }]
  })

  if (!isAdding && changes.length === 0 && undoneIds.length === 0 && !isFlagging) {
    throw new AcceptRefusal(STALE)
  }

  const target = isAdding ? resolveTarget(tree.stages, request.target, workerId) : undefined
  const movesFigures = isAdding || changes.length + removals.length > 0

  // Before any tree write, so the version holds the rozpiska as it was before the decision.
  if (movesFigures) await captureAutoSnapshot(tx, investmentId, userId)

  const stage =
    target === undefined
      ? undefined
      : target.kind === 'stage'
        ? target.stage
        : await insertWorkerStage(tx, investmentId, target.plane, workerId)

  // Summed per etap first: an upsert touching one row twice is a Postgres error, and two lines of one
  // report may name the same pozycja once one of them was re-pointed.
  const qtyByStage = new Map<number, Map<number, number>>()
  const add = (stageId: number, itemId: number, qty: number) => {
    const qtyByItem = qtyByStage.get(stageId) ?? new Map<number, number>()
    qtyByItem.set(itemId, round6((qtyByItem.get(itemId) ?? 0) + qty))
    qtyByStage.set(stageId, qtyByItem)
  }
  if (stage) {
    for (const { decision, itemId } of rozpiskaLines) add(stage.id, itemId, decision.acceptedQty)
  }
  if (recordedStage) {
    for (const { itemId, delta } of [...changes, ...removals]) add(recordedStage.id, itemId, delta)
  }
  const cells: AcceptReportResultT['cells'] = []
  for (const [stageId, qtyByItem] of qtyByStage) {
    const written = await addStageProgress(tx, investmentId, stageId, qtyByItem)
    const isMissing = [...qtyByItem].some(
      ([itemId, qty]) => qty > 0 && !written.some((cell) => cell.itemId === itemId),
    )
    if (isMissing) throw new AcceptRefusal('Część pozycji nie należy już do tej rozpiski.')
    cells.push(...written)
  }

  const decisions: ReportLineDecisionT[] = [
    ...rozpiskaLines.map(({ decision }) => ({
      lineId: decision.lineId,
      acceptedQty: decision.acceptedQty,
      itemId: decision.itemId,
    })),
    ...changedLines.map((decision) => ({
      lineId: decision.lineId,
      acceptedQty: decision.acceptedQty,
    })),
  ]
  await updateReportLines(tx, reportId, decisions)
  await clearLinesAcceptance(tx, reportId, undoneIds)
  await setLinesRejected(tx, reportId, rejectedIds, true)
  await setLinesRejected(tx, reportId, unrejectedIds, false)
  await settleReport(tx, reportId, userId, stage)

  return {
    stage: target?.kind === 'new' ? stage : undefined,
    cells,
    revision: movesFigures ? await bumpInvestmentRevision(tx, investmentId) : undefined,
  }
}

type ResolvedTargetT =
  | { kind: 'stage'; stage: KosztorysStageT }
  | { kind: 'new'; plane: ToolPlaneT }

function resolveTarget(
  stages: KosztorysStageT[],
  target: z.infer<typeof acceptSchema>['target'],
  workerId: number,
): ResolvedTargetT {
  if (target.kind === 'stage') {
    const stage = stages.find((candidate) => candidate.id === target.stageId)
    if (!stage || !isStageMember(stage, workerId))
      throw new AcceptRefusal('Wybrany etap nie jest etapem tego pracownika.')
    return { kind: 'stage', stage }
  }
  const scope = resolveWorkerScope(stages, workerId)
  if (scope.kind === 'ready') {
    if (target.plane && target.plane !== scope.plane) {
      throw new AcceptRefusal(
        'Nowy etap w innym rozliczeniu pomieszałby rozliczenia tego pracownika.',
      )
    }
    return { kind: 'new', plane: scope.plane }
  }
  if (scope.reason !== 'no-stages') {
    throw new AcceptRefusal(ACCEPT_REFUSALS.unsettledPlane)
  }
  if (!target.plane) throw new AcceptRefusal('Wybierz rozliczenie nowego etapu.')
  return { kind: 'new', plane: target.plane }
}
