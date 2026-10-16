import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { sqlList } from '@/lib/db/sql-list'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertStageMembers } from '@/lib/db/stage-split'
import { existingCatalogueIds } from '@/lib/db/work-catalogue'
import { normalizeStageSplit } from '@/lib/kosztorys/stage-split'
import {
  itemWithColumnDefaults,
  storedStageSplit,
  type StoredSnapshotPayloadT,
} from './snapshot-format'
import { insertItems, insertSections, remapNewIds } from './insert-rows'
import type { KosztorysItemT } from './types'

export const STAGE_INSERT_COLUMNS = [
  'investment_id',
  'ordinal',
  'label',
  'plane',
  'split_mode',
  'completed',
] as const
export const PROGRESS_INSERT_COLUMNS = ['item_id', 'stage_id', 'qty_done'] as const

export type InsertKosztorysTreeResultT = {
  droppedWorkerAssignments: number
}

// The live FK cascades when someone is deleted; it does nothing for a restore re-INSERTing the
// recorded id afterwards, which meets the FK head-on and takes the WHOLE restore down with it.
async function liveWorkerIds(db: DbExecutorT, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  // FOR SHARE, not a bare SELECT: under READ COMMITTED a plain read takes no lock, so a user
  // hard-deleted between this check and the stage INSERT would still meet the FK and take the whole
  // restore down.
  const res = await db.execute(sql`
    SELECT id FROM users
    WHERE id IN (${sqlList(ids)}) AND trashed_at IS NULL
    FOR SHARE
  `)
  return new Set(res.rows.map((row) => Number(row.id)))
}

export async function liveCatalogueIds(
  db: DbExecutorT,
  items: readonly KosztorysItemT[],
): Promise<Set<number>> {
  return existingCatalogueIds(db, [
    ...new Set(
      items.flatMap((item) => (item.catalogueItemId === null ? [] : [item.catalogueItemId])),
    ),
  ])
}

export const withLiveCatalogueId = (item: KosztorysItemT, live: Set<number>): KosztorysItemT =>
  item.catalogueItemId === null || live.has(item.catalogueItemId)
    ? item
    : { ...item, catalogueItemId: null }

// ONE bulk `INSERT … RETURNING id` per level, not row-by-row payload.create: a ~1000-row restore was
// ~12.6s paying Payload's full per-doc cost (validate + hooks + create machinery) ×N, serially.
export async function insertKosztorysTree(
  db: DbExecutorT,
  investmentId: number,
  tree: StoredSnapshotPayloadT,
): Promise<InsertKosztorysTreeResultT> {
  const sections = tree.sections ?? []
  const sectionIds = await insertSections(
    db,
    investmentId,
    sections.map((section, index) => ({ displayOrder: section.displayOrder ?? index, section })),
  )
  const sectionIdMap = new Map(sections.map((s, i) => [s.id, sectionIds[i]]))

  const filled = (tree.items ?? []).map(itemWithColumnDefaults)
  const liveCatalogue = await liveCatalogueIds(db, filled)
  const items = filled.map((item) => withLiveCatalogueId(item, liveCatalogue))
  const itemRows = items.flatMap((item) => {
    const sectionId = sectionIdMap.get(item.sectionId)
    return sectionId === undefined ? [] : [{ sectionId, item }]
  })
  const itemIds = await insertItems(db, investmentId, itemRows)
  const itemIdMap = new Map(itemRows.map(({ item }, i) => [item.id, itemIds[i]]))

  const stages = tree.stages ?? []
  const stageIdMap = new Map<number, number>()
  const recordedSplits = stages.map(storedStageSplit)
  const live = await liveWorkerIds(db, [
    ...new Set(recordedSplits.flatMap((split) => split?.members.map((m) => m.workerId) ?? [])),
  ])
  let droppedWorkerAssignments = 0
  const splits = recordedSplits.map((split) => {
    if (!split) return null
    const members = split.members.filter((member) => live.has(member.workerId))
    droppedWorkerAssignments += split.members.length - members.length
    return normalizeStageSplit({ mode: split.mode, members })
  })

  if (stages.length > 0) {
    const rows = stages.map(
      (s, i) =>
        sql`(${investmentId}, ${s.ordinal}, ${s.label ?? null}, ${s.plane ?? null}, ${splits[i]?.mode ?? 'percent'}, ${s.completed ?? false})`,
    )
    const res = await db.execute(sql`
      INSERT INTO kosztorys_stages (${sql.raw(STAGE_INSERT_COLUMNS.join(', '))})
      VALUES ${sql.join(rows, sql.raw(', '))}
      RETURNING id, ordinal
    `)
    // Unlike display_order, `ordinal` is constraint-backed (kosztorys_stages_investment_ordinal_unique),
    // so the key join here can never hit the tie fallback — the INSERT raises 23505 first.
    const stageIds = remapNewIds(
      res.rows,
      (row) => Number(row.ordinal),
      stages.map((s) => s.ordinal),
      'kosztorys_stages',
    )
    stages.forEach((s, i) => stageIdMap.set(s.id, stageIds[i]))
    await insertStageMembers(
      db,
      stageIds.flatMap((stageId, i) => {
        const split = splits[i]
        return split ? [{ stageId, split }] : []
      }),
    )
  }

  const progress = (tree.progress ?? []).filter(
    (p) => itemIdMap.has(p.itemId) && stageIdMap.has(p.stageId),
  )
  if (progress.length > 0) {
    const rows = progress.map(
      (p) => sql`(${itemIdMap.get(p.itemId)}, ${stageIdMap.get(p.stageId)}, ${p.qtyDone ?? 0})`,
    )
    await db.execute(sql`
      INSERT INTO stage_progress (${sql.raw(PROGRESS_INSERT_COLUMNS.join(', '))})
      VALUES ${sql.join(rows, sql.raw(', '))}
    `)
  }

  return { droppedWorkerAssignments }
}
