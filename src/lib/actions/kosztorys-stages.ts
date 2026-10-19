'use server'

import { z } from 'zod'
import { sql } from '@payloadcms/db-postgres'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { mixedPlaneWorkersMessage } from '@/lib/constants/worker-lock'
import { getDb } from '@/lib/db/get-db'
import {
  insertStageMembers,
  replaceStageSplit,
  selectStagePool,
  selectStageWorkerIds,
} from '@/lib/db/stage-split'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { selectOtherPlaneWorkerNames, trashedWorkerMessage } from '@/lib/db/worker-gate'
import { captureAutoSnapshot } from '@/lib/kosztorys/capture-auto-snapshot'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import {
  normalizeStageSplit,
  STAGE_SPLIT_NEEDS_PLANE,
  validateStageSplit,
} from '@/lib/kosztorys/stage-split'
import type { StagePatchT, StageSplitT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { ActionResultT } from '@/types/action'

const stagePlaneSchema = z.enum(TOOL_PLANES)

export async function addStageAction(
  investmentId: number,
  plane: ToolPlaneT,
  split: StageSplitT | null = null,
): Promise<ActionResultT<{ id: number; ordinal: number }>> {
  return investmentAction(
    'addStageAction',
    { investmentId },
    async ({ payload }) => {
      const parsed = validateAction(stagePatchSchema, { plane })
      if (!parsed.success) return parsed
      const parsedSplit = validateAction(stageSplitSchema, split)
      if (!parsedSplit.success) return parsedSplit
      const normalized = normalizeStageSplit(parsedSplit.data)
      // A new etap has no executed work, so only a 0 zł amount could pass the cap; the copied
      // percentages are what carries over.
      const refusal = parsedSplit.data && normalized && validateStageSplit(parsedSplit.data, 0)
      if (refusal) return { success: false, error: refusal }
      return withPayloadTransaction(
        payload,
        async (req) => {
          const txDb = await getDb(payload, req)
          const workerIds = normalized?.members.map((member) => member.workerId) ?? []
          const trashedWorker = await trashedWorkerMessage(txDb, workerIds)
          if (trashedWorker) return { success: false as const, error: trashedWorker }
          const mixed = await selectOtherPlaneWorkerNames(txDb, { investmentId, plane, workerIds })
          if (mixed.length > 0) {
            return { success: false as const, error: mixedPlaneWorkersMessage(mixed) }
          }
          const existing = await payload.find({
            collection: 'kosztorys-stages',
            where: { investment: { equals: investmentId } },
            sort: '-ordinal',
            limit: 1,
            depth: 0,
            req,
          })
          const nextOrdinal = (existing.docs[0]?.ordinal ?? 0) + 1
          const created = await payload.create({
            collection: 'kosztorys-stages',
            data: {
              investment: investmentId,
              ordinal: nextOrdinal,
              plane,
              splitMode: normalized?.mode ?? 'percent',
            },
            req,
          })
          if (normalized) {
            await insertStageMembers(txDb, [{ stageId: created.id, split: normalized }])
          }
          return { success: true as const, data: { id: created.id, ordinal: nextOrdinal } }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysStages'],
  )
}

const stagePatchSchema = z
  .object({
    label: z.string().nullable(),
    plane: stagePlaneSchema,
    completed: z.boolean(),
  })
  .partial()

const stageSplitSchema = z
  .object({
    mode: z.enum(['percent', 'amount']),
    members: z.array(
      z.object({
        workerId: z.number().int().positive(),
        value: z.number(),
        takesRest: z.boolean(),
      }),
    ),
  })
  .nullable()

export async function updateStageAction(
  stageId: number,
  patch: StagePatchT,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageAction',
    { kind: 'stage', id: stageId },
    async ({ payload, investmentId }) => {
      const parsed = validateAction(stagePatchSchema, patch)
      if (!parsed.success) return parsed
      const { plane } = parsed.data
      if (plane) {
        const db = await getDb(payload)
        const mixed = await selectOtherPlaneWorkerNames(db, {
          investmentId,
          plane,
          workerIds: await selectStageWorkerIds(db, stageId),
          exceptStageId: stageId,
        })
        if (mixed.length > 0) return { success: false, error: mixedPlaneWorkersMessage(mixed) }
      }
      await payload.update({ collection: 'kosztorys-stages', id: stageId, data: parsed.data })
      return { success: true }
    },
    ['kosztorysStages'],
  )
}

const STAGE_MISSING = 'Etap nie istnieje.'

export async function updateStageSplitAction(
  stageId: number,
  split: StageSplitT | null,
): Promise<ActionResultT> {
  return investmentAction(
    'updateStageSplitAction',
    { kind: 'stage', id: stageId },
    async ({ payload, investmentId }) => {
      const parsed = validateAction(stageSplitSchema, split)
      if (!parsed.success) return parsed
      // Validated as sent, written normalized: normalizing repairs a missing rest holder by zeroing
      // the first member's amount, which would move money instead of refusing the save.
      const normalized = normalizeStageSplit(parsed.data)
      return withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const txDb = await getDb(payload, req)
          const res = await txDb.execute(sql`
            SELECT plane FROM kosztorys_stages WHERE id = ${stageId} FOR UPDATE
          `)
          const stage = res.rows[0]
          // Deleted between the gate and the lock: the code makes the editor reseed its tree.
          if (!stage) return { success: false, error: STAGE_MISSING, code: 'NOT_FOUND' }
          if (parsed.data && normalized) {
            if (stage.plane == null) return { success: false, error: STAGE_SPLIT_NEEDS_PLANE }
            const refusal = validateStageSplit(parsed.data, await selectStagePool(txDb, stageId))
            if (refusal) return { success: false, error: refusal }
          }
          const workerIds = normalized?.members.map((member) => member.workerId) ?? []
          const trashedWorker = await trashedWorkerMessage(txDb, workerIds)
          if (trashedWorker) return { success: false, error: trashedWorker }
          const mixed = await selectOtherPlaneWorkerNames(txDb, {
            investmentId,
            plane: stage.plane as ToolPlaneT | null,
            workerIds,
            exceptStageId: stageId,
          })
          if (mixed.length > 0) return { success: false, error: mixedPlaneWorkersMessage(mixed) }
          await replaceStageSplit(txDb, stageId, normalized)
          return { success: true }
        },
        { skipRevalidation: true },
      )
    },
    ['kosztorysStages'],
  )
}

const stageIdSchema = z.object({ stageId: z.number() })

export async function removeStageAction(stageId: number): Promise<ActionResultT> {
  return investmentAction(
    'removeStageAction',
    { kind: 'stage', id: stageId },
    async ({ payload, user, investmentId }) => {
      const parsed = validateAction(stageIdSchema, { stageId })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await captureAutoSnapshot(db, investmentId, user.id)
      await payload.delete({ collection: 'kosztorys-stages', id: parsed.data.stageId })
      return { success: true }
    },
    ['kosztorysStages', 'stageProgress'],
  )
}

const stageProgressSchema = z.object({
  itemId: z.number(),
  stageId: z.number(),
  qtyDone: z.coerce.number(),
})

export async function setStageProgressAction(
  itemId: number,
  stageId: number,
  qtyDone: number,
): Promise<ActionResultT> {
  return investmentAction(
    'setStageProgressAction',
    { kind: 'item', id: itemId },
    async ({ payload }) => {
      const parsed = validateAction(stageProgressSchema, { itemId, stageId, qtyDone })
      if (!parsed.success) return parsed
      const db = await getDb(payload)
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${parsed.data.itemId}, ${parsed.data.stageId}, ${parsed.data.qtyDone}, now(), now())
        ON CONFLICT (item_id, stage_id)
        DO UPDATE SET qty_done = ${parsed.data.qtyDone}, updated_at = now()
      `)
      return { success: true }
    },
    ['stageProgress'],
    { deferRefresh: true },
  )
}
