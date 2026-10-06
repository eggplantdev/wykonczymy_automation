'use server'

import type { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { investmentEntityOpts } from '@/lib/cache/tags'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { lockInvestmentGates } from '@/lib/db/investment-gate'
import { bumpInvestmentRevision } from '@/lib/db/investment-revision'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { addStageProgress } from '@/lib/db/stage-progress'
import { insertWorkerStage } from '@/lib/db/stage-split'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { listCatalogueItemsByIds } from '@/lib/db/work-catalogue'
import {
  claimPendingReport,
  clearLinesAcceptance,
  markReportAccepted,
  readWorkerReport,
  reopenReportIfNoneAccepted,
  updateReportLines,
  type ReportLineDecisionT,
  type WorkerReportLineRowT,
} from '@/lib/db/worker-reports'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import { withTranslation } from '@/lib/i18n/description-translations'
import { isTranslationLanguage } from '@/lib/i18n/languages'
import { itemFromFields } from '@/lib/kosztorys/item-from-fields'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { ACCEPT_REFUSALS } from '@/lib/kosztorys/worker-report/refusals'
import { reviewedDescription } from '@/lib/kosztorys/worker-report/reviewed-description'
import { acceptSchema, reportIdSchema } from '@/lib/kosztorys/worker-report/schemas'
import type { AcceptReportInputT, AcceptReportResultT } from '@/lib/kosztorys/worker-report/types'
import { isStageMember, resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { round6 } from '@/lib/utils/round'
import type { ActionResultT } from '@/types/action'

const NOT_PENDING = 'To zgłoszenie zostało już rozpatrzone.'

// Thrown inside the transaction so everything it already wrote rolls back.
class AcceptRefusal extends Error {}

const STALE = 'Zgłoszenie zmieniło się w innym oknie — odśwież je.'

export async function rejectWorkerReportAction(
  investmentId: number,
  reportId: number,
): Promise<ActionResultT> {
  return investmentAction(
    'rejectWorkerReportAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(reportIdSchema, reportId)
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      const workerId = await claimPendingReport(db, investmentId, parsed.data, 'rejected', user.id)
      if (workerId === null) return { success: false, error: NOT_PENDING }
      return { success: true }
    },
    // Nothing cached reads a report; the expiry is only what re-renders the shell's nav badge.
    undefined,
    investmentEntityOpts(investmentId),
  )
}

/**
 * Brings the etap in line with the kierownik's decision: a newly accepted line adds its ilość, an
 * already accepted one adds only the difference to what it was accepted at, and an undone one takes
 * its ilość back out. Everything — the claim, the auto version, a new etap, the new pozycje, the
 * figures and the report's record — is one transaction, so a failure anywhere leaves the report and
 * the rozpiska as they were.
 */
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

      // Only ids come from the client: every katalog figure is re-read here.
      const catalogueIds = [
        ...new Set(request.extras.flatMap((extra) => extra.catalogueItemId ?? [])),
      ]
      const catalogue = new Map(
        (await listCatalogueItemsByIds(await getDb(payload), catalogueIds)).map((entry) => [
          entry.id,
          entry,
        ]),
      )

      try {
        return await withPayloadTransaction(
          payload,
          async (req) => {
            const tx = await getDb(payload, req)
            const data = await acceptInTransaction(tx, request, catalogue, user.id)
            return { success: true as const, data }
          },
          { skipRevalidation: true },
        )
      } catch (error) {
        if (error instanceof AcceptRefusal) return { success: false, error: error.message }
        throw error
      }
    },
    ['kosztorysStages', 'stageProgress', 'kosztorysItems', 'investments'],
  )
}

async function acceptInTransaction(
  tx: DbExecutorT,
  request: z.infer<typeof acceptSchema>,
  catalogue: ReadonlyMap<number, WorkCatalogueItemT>,
  userId: number,
): Promise<AcceptReportResultT> {
  const { investmentId, reportId } = request
  // Re-gated under the row lock: the gate `investmentAction` ran is a read another request can
  // overtake before this transaction starts.
  const gate = (await lockInvestmentGates(tx, [investmentId])).get(investmentId)
  if (!gate) throw new AcceptRefusal('Inwestycja nie istnieje.')
  if (gate.lockMessage) throw new AcceptRefusal(gate.lockMessage)

  const report = await readWorkerReport(tx, investmentId, reportId)
  const tree = await selectKosztorysTreeData(tx, investmentId)
  if (!report || !tree) throw new AcceptRefusal('Zgłoszenie nie istnieje.')
  const { workerId } = report.report

  const lineById = new Map(report.lines.map((line) => [line.id, line]))
  const decidedIds = [
    ...[...request.lines, ...request.extras].map((decision) => decision.lineId),
    ...request.undone,
  ]
  if (new Set(decidedIds).size !== decidedIds.length) {
    throw new AcceptRefusal('Pozycja zgłoszenia powtarza się w decyzji.')
  }
  if (decidedIds.some((lineId) => !lineById.has(lineId))) {
    throw new AcceptRefusal('Część pozycji nie należy do tego zgłoszenia.')
  }
  const isAccepted = (lineId: number) => lineById.get(lineId)?.acceptedQty !== null
  // A decision states what the window saw; another window's accept since then makes it a different
  // decision, never silently a change of that one.
  const isStale =
    request.lines.some(
      (decision) => decision.seenQty !== (lineById.get(decision.lineId)?.acceptedQty ?? undefined),
    ) || request.extras.some((extra) => isAccepted(extra.lineId))
  if (isStale) throw new AcceptRefusal(STALE)
  const freshLines = request.lines.filter((decision) => !isAccepted(decision.lineId))
  const changedLines = request.lines.filter((decision) => isAccepted(decision.lineId))
  // A line undone in another window meanwhile has nothing left to take back.
  const undoneIds = request.undone.filter(isAccepted)
  const isAdding = freshLines.length + request.extras.length > 0

  // One report, one etap: a change or an untick lands in the etap the report names, so the rest may
  // join only that one — and none at all while it is gone or no longer his, until those lines are
  // unticked and the report is free again.
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

  // An accepted line changes only in the etap and the pozycja it already went to.
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
  // A deleted etap or pozycja took its figure with it: only the record is left to clear.
  const removals = undoneIds.flatMap((lineId) => {
    const line = lineById.get(lineId) as WorkerReportLineRowT
    const itemId = acceptedItemOf(line)
    if (!recordedStage || itemId === null || !itemIds.has(itemId)) return []
    return [{ itemId, delta: -(line.acceptedQty as number) }]
  })

  if (!isAdding && changes.length === 0 && undoneIds.length === 0) throw new AcceptRefusal(STALE)

  for (const extra of request.extras) {
    const line = lineById.get(extra.lineId) as WorkerReportLineRowT
    const hasPrice =
      extra.catalogueItemId === undefined
        ? extra.clientPrice !== undefined
        : catalogue.has(extra.catalogueItemId)
    if (!hasPrice) {
      throw new AcceptRefusal(
        `„${line.description}” — podaj cenę j.m. albo wybierz pracę z katalogu.`,
      )
    }
    // A scan reads no j.m. it cannot match to the kosztorys's; only a katalog praca can supply one.
    if (extra.catalogueItemId === undefined && line.unit.trim() === '') {
      throw new AcceptRefusal(`„${line.description}” — brak j.m., wybierz pracę z katalogu.`)
    }
  }

  const target = isAdding ? resolveTarget(tree.stages, request.target, workerId) : undefined

  // Before any tree write, so the version holds the rozpiska as it was before the decision.
  await captureAutoSnapshot(tx, investmentId, userId)

  const stage =
    target === undefined
      ? undefined
      : target.kind === 'stage'
        ? target.stage
        : await insertWorkerStage(tx, investmentId, target.plane, workerId)

  const appended: AcceptReportResultT['appended'] = []
  const createdByLine = new Map<number, number>()
  for (const [sectionId, extras] of Map.groupBy(request.extras, (extra) => extra.sectionId)) {
    const owner = await sectionOwnerAndNextItemOrder(tx, sectionId)
    if (!owner || owner.investmentId !== investmentId) {
      throw new AcceptRefusal('Wybrana sekcja nie istnieje.')
    }
    const items = extras.map((extra, index) =>
      extraAsItem(
        extra,
        lineById.get(extra.lineId) as WorkerReportLineRowT,
        catalogue,
        owner.section,
        owner.nextDisplayOrder + index,
      ),
    )
    const newIds = await insertItems(
      tx,
      investmentId,
      items.map((item) => ({ sectionId, item })),
    )
    extras.forEach((extra, index) => createdByLine.set(extra.lineId, newIds[index]))
    appended.push({
      ...owner.section,
      items: items.map((item, index) => ({ ...item, id: newIds[index] })),
    })
  }

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
    for (const extra of request.extras) {
      add(stage.id, createdByLine.get(extra.lineId) as number, extra.acceptedQty)
    }
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
    ...request.extras.map((extra) => ({
      lineId: extra.lineId,
      acceptedQty: extra.acceptedQty,
      createdItemId: createdByLine.get(extra.lineId),
      catalogueItemId: extra.catalogueItemId,
    })),
  ]
  await markReportAccepted(tx, reportId, userId, stage)
  await updateReportLines(tx, reportId, decisions)
  await clearLinesAcceptance(tx, reportId, undoneIds)
  await reopenReportIfNoneAccepted(tx, reportId)

  return {
    stage: target?.kind === 'new' ? stage : undefined,
    appended,
    cells,
    revision: await bumpInvestmentRevision(tx, investmentId),
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

// A katalog wpis comes over as the picker copies it; the worker's own opis gets only the cena j.m.
// the kierownik typed — its stawki stay „auto". A translated opis lands in Polish, and the worker's
// own words become its current translation, so his crew reads what he wrote — only in a language
// the editor carries; any other still lands in Polish, with no translation to show.
function extraAsItem(
  extra: z.infer<typeof acceptSchema>['extras'][number],
  line: WorkerReportLineRowT,
  catalogue: ReadonlyMap<number, WorkCatalogueItemT>,
  section: KosztorysSectionT,
  displayOrder: number,
): KosztorysItemT {
  const entry =
    extra.catalogueItemId === undefined ? undefined : catalogue.get(extra.catalogueItemId)
  if (entry) return itemFromFields(entry, section.id, displayOrder)
  const language = line.descriptionLanguage
  const polish = line.polishDescription
  return {
    id: 0,
    sectionId: section.id,
    displayOrder,
    description: reviewedDescription(line),
    descriptionTranslations:
      polish !== null && isTranslationLanguage(language)
        ? withTranslation({}, language, line.description, polish)
        : {},
    unit: line.unit,
    plannedQty: 0,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: extra.clientPrice ?? 0,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    wToolsOverrideCoeff: null,
    ownToolsOverrideCoeff: null,
    note: null,
  }
}
