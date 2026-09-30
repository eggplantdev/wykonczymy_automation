'use server'

import { z } from 'zod'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { tokenAction } from '@/lib/actions/token-action'
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
  insertWorkerReport,
  readWorkerReport,
  setReportTarget,
  updateReportLines,
  type ReportLineDecisionT,
  type WorkerReportLineInputT,
  type WorkerReportLineRowT,
} from '@/lib/db/worker-reports'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { sectionOwnerAndNextItemOrder } from '@/lib/kosztorys/create-item'
import { insertItems } from '@/lib/kosztorys/insert-rows'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import { catalogueEntryAsItem } from '@/lib/kosztorys/work-catalogue/place-catalogue-items'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { unitOptions } from '@/lib/kosztorys/worker-report/unit-options'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import type {
  AcceptReportInputT,
  AcceptReportResultT,
  SendReportLineT,
} from '@/lib/kosztorys/worker-report/types'
import type { ActionResultT } from '@/types/action'

const QTY_MESSAGE = 'Ilość musi być większa od zera'
const MAX_LINES = 2000

const lineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rozpiska'),
    itemId: z.number().int().positive(),
    qty: z.number().positive(QTY_MESSAGE),
  }),
  z.object({
    kind: z.literal('extra'),
    description: z.string().trim().min(1, 'Opisz dopisaną pracę').max(1000),
    unit: z.string().trim().min(1, 'Wybierz j.m. dopisanej pracy').max(40),
    qty: z.number().positive(QTY_MESSAGE),
  }),
])

const linesSchema = z
  .array(lineSchema)
  .min(1, 'Zgłoszenie nie ma żadnej pozycji')
  .max(MAX_LINES, 'Za dużo pozycji w jednym zgłoszeniu')

/**
 * A rozpiska line carries only its pozycja and ilość: opis, j.m. and sekcja are copied here from the
 * live pozycja, so what the kierownik reviews is what the rozpiska said at send time — never text
 * the client made up. No cache tags: every report read is uncached.
 */
export async function sendWorkerReportAction(
  token: string,
  lines: SendReportLineT[],
): Promise<ActionResultT<{ reportId: number }>> {
  const parsed = validateAction(linesSchema, lines)
  if (!parsed.success) return parsed

  const itemIds = parsed.data.flatMap((line) => (line.kind === 'rozpiska' ? [line.itemId] : []))
  if (new Set(itemIds).size !== itemIds.length) {
    return { success: false, error: 'Pozycja powtarza się w zgłoszeniu' }
  }

  return tokenAction<{ reportId: number }>(
    'sendWorkerReportAction',
    { token, itemIds },
    async ({ db, investmentId, workerId, tree }) => {
      const itemById = new Map(
        tree.sections.flatMap((section) =>
          section.items.map((item) => [item.id, { item, sectionName: section.name }] as const),
        ),
      )
      const allowedUnits = new Set(
        unitOptions(
          [...itemById.values()].map(({ item }) => item.unit ?? ''),
          '',
        ),
      )

      const stored: WorkerReportLineInputT[] = []
      for (const line of parsed.data) {
        if (line.kind === 'rozpiska') {
          const found = itemById.get(line.itemId)
          if (!found) continue // unreachable: tokenAction refuses an itemId outside this rozpiska
          const { item, sectionName } = found
          stored.push({
            kind: 'rozpiska',
            itemId: item.id,
            description: item.description ?? '',
            unit: item.unit ?? '',
            sectionName,
            reportedQty: line.qty,
          })
          continue
        }
        const unit = cleanUnit(line.unit)
        if (!allowedUnits.has(unit)) {
          return { success: false, error: `Nieznana j.m. „${line.unit}”` }
        }
        stored.push({
          kind: 'extra',
          itemId: null,
          description: line.description,
          unit,
          sectionName: null,
          reportedQty: line.qty,
        })
      }

      // One CTE statement, so it is atomic without a transaction of its own.
      const reportId = await insertWorkerReport(db, { investmentId, workerId, lines: stored })
      return { success: true, data: { reportId } }
    },
  )
}

const NOT_PENDING = 'To zgłoszenie zostało już rozpatrzone.'

const idSchema = z.number().int().positive()
const acceptedQtySchema = z.number().positive(QTY_MESSAGE)

const acceptSchema = z
  .object({
    investmentId: idSchema,
    reportId: idSchema,
    target: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('stage'), stageId: idSchema }),
      z.object({ kind: z.literal('new'), plane: z.enum(TOOL_PLANES).optional() }),
    ]),
    lines: z.array(
      z.object({ lineId: idSchema, acceptedQty: acceptedQtySchema, itemId: idSchema.optional() }),
    ),
    extras: z.array(
      z.object({
        lineId: idSchema,
        acceptedQty: acceptedQtySchema,
        sectionId: idSchema,
        clientPrice: z.number().min(0).optional(),
        catalogueItemId: idSchema.optional(),
      }),
    ),
  })
  .refine((input) => input.lines.length + input.extras.length > 0, {
    message: 'Zaznacz co najmniej jedną pozycję',
  })

// Thrown inside the transaction so everything it already wrote — the claim first of all — rolls back.
class AcceptRefusal extends Error {}

export async function rejectWorkerReportAction(
  investmentId: number,
  reportId: number,
): Promise<ActionResultT> {
  return investmentAction(
    'rejectWorkerReportAction',
    { investmentId },
    async ({ payload, user }) => {
      const parsed = validateAction(idSchema, reportId)
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      const workerId = await claimPendingReport(db, investmentId, parsed.data, 'rejected', user.id)
      if (workerId === null) return { success: false, error: NOT_PENDING }
      return { success: true }
    },
    ['investments'],
  )
}

/**
 * Adds the accepted ilości to one etap of the reporting worker. Everything — the claim, the auto
 * version, a new etap, the new pozycje, the addition and the report's record — is one transaction, so
 * a failure anywhere leaves the report pending and the rozpiska as it was.
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

  const workerId = await claimPendingReport(tx, investmentId, reportId, 'accepted', userId)
  if (workerId === null) throw new AcceptRefusal(NOT_PENDING)

  const report = await readWorkerReport(tx, investmentId, reportId)
  const tree = await selectKosztorysTreeData(tx, investmentId)
  if (!report || !tree) throw new AcceptRefusal(NOT_PENDING)

  const lineById = new Map(report.lines.map((line) => [line.id, line]))
  const decidedIds = [...request.lines, ...request.extras].map((decision) => decision.lineId)
  if (new Set(decidedIds).size !== decidedIds.length) {
    throw new AcceptRefusal('Pozycja zgłoszenia powtarza się w decyzji.')
  }
  if (decidedIds.some((lineId) => !lineById.has(lineId))) {
    throw new AcceptRefusal('Część pozycji nie należy do tego zgłoszenia.')
  }

  const itemIds = new Set(tree.items.map((item) => item.id))
  const rozpiskaLines = request.lines.map((decision) => {
    const line = lineById.get(decision.lineId) as WorkerReportLineRowT
    const itemId = decision.itemId ?? line.itemId
    if (itemId === null || !itemIds.has(itemId)) {
      throw new AcceptRefusal(
        `„${line.description}” — wybierz pozycję z rozpiski albo przenieś ją do prac spoza rozpiski.`,
      )
    }
    return { decision, itemId }
  })

  const sectionById = new Map(tree.sections.map((section) => [section.id, section]))
  for (const extra of request.extras) {
    const line = lineById.get(extra.lineId) as WorkerReportLineRowT
    if (!sectionById.has(extra.sectionId)) {
      throw new AcceptRefusal(`„${line.description}” — wybrana sekcja nie istnieje.`)
    }
    const hasPrice =
      extra.catalogueItemId === undefined
        ? extra.clientPrice !== undefined
        : catalogue.has(extra.catalogueItemId)
    if (!hasPrice) {
      throw new AcceptRefusal(
        `„${line.description}” — podaj cenę j.m. albo wybierz pracę z katalogu.`,
      )
    }
  }

  const target = resolveTarget(tree.stages, request.target, workerId)

  // Before any tree write, so the version holds the rozpiska as it was before the accept.
  await captureAutoSnapshot(tx, investmentId, userId)

  const stage =
    target.kind === 'stage'
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

  // Summed first: an upsert touching one row twice is a Postgres error, and two lines of one report
  // may name the same pozycja once one of them was re-pointed.
  const qtyByItem = new Map<number, number>()
  const add = (itemId: number, qty: number) =>
    qtyByItem.set(itemId, (qtyByItem.get(itemId) ?? 0) + qty)
  for (const { decision, itemId } of rozpiskaLines) add(itemId, decision.acceptedQty)
  for (const extra of request.extras) {
    add(createdByLine.get(extra.lineId) as number, extra.acceptedQty)
  }
  const cells = await addStageProgress(tx, investmentId, stage.id, qtyByItem)
  if (cells.length !== qtyByItem.size) {
    throw new AcceptRefusal('Część pozycji nie należy już do tej rozpiski.')
  }

  const decisions: ReportLineDecisionT[] = [
    ...rozpiskaLines.map(({ decision }) => ({
      lineId: decision.lineId,
      acceptedQty: decision.acceptedQty,
      itemId: decision.itemId,
    })),
    ...request.extras.map((extra) => ({
      lineId: extra.lineId,
      acceptedQty: extra.acceptedQty,
      createdItemId: createdByLine.get(extra.lineId),
      catalogueItemId: extra.catalogueItemId,
    })),
  ]
  await updateReportLines(tx, reportId, decisions)
  await setReportTarget(tx, reportId, stage)

  return {
    stage: target.kind === 'new' ? stage : undefined,
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
    const stage = stages.find(
      (candidate) =>
        candidate.id === target.stageId &&
        candidate.split?.members.some((member) => member.workerId === workerId),
    )
    if (!stage) throw new AcceptRefusal('Wybrany etap nie jest etapem tego pracownika.')
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
    throw new AcceptRefusal(
      'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.',
    )
  }
  if (!target.plane) throw new AcceptRefusal('Wybierz rozliczenie nowego etapu.')
  return { kind: 'new', plane: target.plane }
}

// A katalog wpis comes over as the picker copies it; the worker's own opis gets only the cena j.m.
// the kierownik typed — its stawki stay „auto".
function extraAsItem(
  extra: z.infer<typeof acceptSchema>['extras'][number],
  line: WorkerReportLineRowT,
  catalogue: ReadonlyMap<number, WorkCatalogueItemT>,
  section: KosztorysSectionT,
  displayOrder: number,
): KosztorysItemT {
  const entry =
    extra.catalogueItemId === undefined ? undefined : catalogue.get(extra.catalogueItemId)
  if (entry) return catalogueEntryAsItem(entry, section.id, displayOrder)
  return {
    id: 0,
    sectionId: section.id,
    displayOrder,
    description: line.description,
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
