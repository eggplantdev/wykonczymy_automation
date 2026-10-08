import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { sqlList } from '@/lib/db/sql-list'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertStageMembers } from '@/lib/db/stage-split'
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
] as const
export const PROGRESS_INSERT_COLUMNS = ['item_id', 'stage_id', 'qty_done'] as const

export type InsertKosztorysTreeResultT = {
  // Etap memberships whose person no longer exists, dropped on restore — one per (etap, person). Their
  // share moves to the rest of the etap, or to the residual bucket when nobody is left.
  droppedWorkerAssignments: number
}

// A snapshot outlives the people it names, and an etap member is the one row here pointing at a row
// this module doesn't own. The live FK cascades when someone is deleted; it does nothing for a
// restore re-INSERTing the recorded id afterwards, which meets the FK head-on and takes the WHOLE
// restore down with it (EX-641). Since the person can never come back, blocking would make that
// snapshot permanently unrestorable — so a dangling member is dropped and the split normalised (the
// next member takes the rest; nobody left = unassigned), the same tolerance this module already
// applies to a dangling parent. Unassigned is a legitimate resting state (the summary has a residual
// row for it), not a corrupted one. A worker in the kosz is dropped the same way: restoring a
// snapshot must not put back on an etap someone the split editor would refuse (EX-918).
async function liveWorkerIds(db: DbExecutorT, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set()
  // FOR SHARE, not a bare SELECT: under READ COMMITTED a plain read takes no lock, so a user
  // hard-deleted between this check and the stage INSERT would still meet the FK and take the whole
  // restore down — the very failure above, merely rarer. The lock holds the rows for the caller's
  // transaction; the id set is bounded by etap count, so it costs nothing worth measuring.
  const res = await db.execute(sql`
    SELECT id FROM users
    WHERE id IN (${sqlList(ids)}) AND trashed_at IS NULL
    FOR SHARE
  `)
  return new Set(res.rows.map((row) => Number(row.id)))
}

// A katalog entry deleted since the payload was written is forgotten rather than carried: the id is a
// soft reference with no FK, so it would insert fine, but a pozycja naming a dead entry would claim a
// link nothing can follow. No lock, unlike liveWorkerIds — nothing fails if an entry dies mid-restore,
// the id just goes stale the same way it would a second later.
export async function liveCatalogueIds(
  db: DbExecutorT,
  items: readonly KosztorysItemT[],
): Promise<Set<number>> {
  const ids = [
    ...new Set(items.flatMap((item) => (item.catalogueItemId === null ? [] : [item.catalogueItemId]))),
  ]
  if (ids.length === 0) return new Set()
  const res = await db.execute(sql`SELECT id FROM work_catalogue_items WHERE id IN (${sqlList(ids)})`)
  return new Set(res.rows.map((row) => Number(row.id)))
}

export const withLiveCatalogueId = (item: KosztorysItemT, live: Set<number>): KosztorysItemT =>
  item.catalogueItemId === null || live.has(item.catalogueItemId)
    ? item
    : { ...item, catalogueItemId: null }

// Bulk-insert a serialized kosztorys tree onto an investment, on a caller-owned transaction handle.
// Shared by restoreKosztorys (wipe → insert → settings) and applyPreset (insert-only) — each caller
// owns the transaction and adds its own wipe/settings semantics around this.
//
// ONE bulk `INSERT … RETURNING id` per level, not row-by-row payload.create: a ~1000-row restore was
// ~12.6s paying Payload's full per-doc cost (validate + hooks + create machinery) ×N, serially. Raw
// insert on the tx-scoped handle loses nothing (the rows were valid when captured) and drops it well
// under a second. Old→new id maps join RETURNING on each row's natural key, never on Postgres's row
// order — see the contract note in insert-rows.ts. Insert order is FK-safe: sections → items → stages
// → progress. Tolerant deserialization: missing arrays default to empty; a child whose parent is
// absent is skipped rather than orphaned, so an older payload survives an additive migration.
export async function insertKosztorysTree(
  db: DbExecutorT,
  investmentId: number,
  tree: StoredSnapshotPayloadT,
): Promise<InsertKosztorysTreeResultT> {
  const sections = tree.sections ?? []
  const sectionIds = await insertSections(
    db,
    investmentId,
    // `?? index`, not `?? 0` — same natural-key reason as itemWithColumnDefaults above.
    sections.map((section, index) => ({ displayOrder: section.displayOrder ?? index, section })),
  )
  const sectionIdMap = new Map(sections.map((s, i) => [s.id, sectionIds[i]]))

  const filled = (tree.items ?? []).map(itemWithColumnDefaults)
  const liveCatalogue = await liveCatalogueIds(db, filled)
  const items = filled.map((item) => withLiveCatalogueId(item, liveCatalogue))
  // Skip an item whose parent section is absent (dangling FK).
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
        sql`(${investmentId}, ${s.ordinal}, ${s.label ?? null}, ${s.plane ?? null}, ${splits[i]?.mode ?? 'percent'})`,
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

  // Skip a progress row whose item or stage is absent (dangling FK).
  const progress = (tree.progress ?? []).filter(
    (p) => itemIdMap.has(p.itemId) && stageIdMap.has(p.stageId),
  )
  if (progress.length > 0) {
    const rows = progress.map(
      // `?? 0` for the same 23502 reason as itemWithColumnDefaults above.
      (p) => sql`(${itemIdMap.get(p.itemId)}, ${stageIdMap.get(p.stageId)}, ${p.qtyDone ?? 0})`,
    )
    await db.execute(sql`
      INSERT INTO stage_progress (${sql.raw(PROGRESS_INSERT_COLUMNS.join(', '))})
      VALUES ${sql.join(rows, sql.raw(', '))}
    `)
  }

  return { droppedWorkerAssignments }
}
