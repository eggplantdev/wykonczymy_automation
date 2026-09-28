import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  LOCKED_INVESTMENT_STATUS,
  TEMPLATE_INVESTMENT_STATUS,
} from '@/lib/constants/investment-lock'
import {
  SNAPSHOT_SCHEMA_VERSION,
  assertReadableSchemaVersion,
  type KosztorysSnapshotPayloadT,
  type SnapshotKindT,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { HistoryKindT, HistoryMetaT } from '@/lib/kosztorys/history/types'
import type { DbExecutorT } from './get-db'

// The single reader/writer of the raw kosztorys_snapshots table (no Payload collection — the
// notification_reads pattern). Retention has one authority, gcSnapshots, swept daily by the cron;
// nothing prunes on the insert path, so a capture is a plain INSERT.

// THE RETENTION POLICY, in full:
//
//   0–30 days    every snapshot survives (~10 min apart while someone is editing)
//   30–120 days  one per calendar day
//   120–365 days one per calendar week
//   past 365     gone, auto and manual alike
//
// The survivor of a bucket is its NEWEST row — how the work was left that day/week, not how it
// started. Manual snapshots are exempt from both bands, bounded only by MAX_AGE_DAYS.
//
// `named` („Zapisz jako…") and `daily` (the nightly end-of-day state) are what the INVESTOR sees as
// the change history, so they are never thinned by the bands and the 365-day ceiling does not reach
// them: they live as long as the investment is open, and go a year after it was completed
// (`completed_at`). A completed investment with no `completed_at` keeps them — investor history is
// never deleted on missing data. `auto` and `manual` are the owner's restore points only.
const FULL_DENSITY_DAYS = 30
const DAILY_BAND_DAYS = 120
const MAX_AGE_DAYS = 365
const INVESTOR_HISTORY_DAYS_AFTER_COMPLETION = 365

// Without the jsonb `payload`: a list must never load ~1000 rows × N snapshots of tree data.
export type SnapshotMetaT = {
  id: number
  investmentId: number
  kind: SnapshotKindT
  label: string | null
  takenAt: string
  takenBy: number | null
}

// A restore point belongs to the szablon the investment held when it was taken. For a real
// investment `template_preset_id` is NULL on both sides and the clause is a no-op; for the warsztat —
// one investment shared by every szablon — it keeps one szablon's history out of another's. Stamped
// from the investment row so no caller can forget it.
const HELD_PRESET = (investmentId: number) =>
  sql`(SELECT "template_preset_id" FROM investments WHERE id = ${investmentId})`

export async function insertSnapshot(
  db: DbExecutorT,
  params: {
    investmentId: number
    kind: SnapshotKindT
    label: string | null
    takenBy: number | null
    payload: KosztorysSnapshotPayloadT
    // The nightly capture stamps the end of the day it describes, not the moment it ran.
    takenAt?: Date
  },
): Promise<number> {
  const takenAt = params.takenAt ? sql`${params.takenAt.toISOString()}::timestamptz` : sql`now()`
  const res = await db.execute(sql`
    INSERT INTO kosztorys_snapshots (
      investment_id, kind, label, taken_by, schema_version, payload, template_preset_id, taken_at
    )
    VALUES (
      ${params.investmentId}, ${params.kind}, ${params.label}, ${params.takenBy},
      ${SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb,
      ${HELD_PRESET(params.investmentId)}, ${takenAt}
    )
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

// The investments whose kosztorys may still change: szablon (the workbench) and completed (locked)
// fall out by status, the trash by its own column.
export async function listDailyEligibleInvestmentIds(db: DbExecutorT): Promise<number[]> {
  const res = await db.execute(sql`
    SELECT id FROM investments
    WHERE status NOT IN (${LOCKED_INVESTMENT_STATUS}, ${TEMPLATE_INVESTMENT_STATUS})
      AND trashed_at IS NULL
    ORDER BY id
  `)
  return res.rows.map((row) => Number(row.id))
}

export async function latestSnapshot(
  db: DbExecutorT,
  investmentId: number,
  kind: SnapshotKindT,
): Promise<{ takenAt: Date; payload: StoredSnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT taken_at, payload FROM kosztorys_snapshots
    WHERE investment_id = ${investmentId} AND kind = ${kind}
    ORDER BY taken_at DESC, id DESC
    LIMIT 1
  `)
  const row = res.rows[0]
  if (!row) return null
  return {
    takenAt: new Date(row.taken_at as string | Date),
    payload: row.payload as StoredSnapshotPayloadT,
  }
}

// The restore path resolves the target investment from the row itself rather than trusting a
// client-passed value. Null when the id doesn't exist or the point belongs to a szablon the warsztat
// no longer holds — filtering the drawer only shapes what is OFFERED, and a stale tab still holds the
// old ids. The caller reports both as „nie znaleziono wersji".
export async function getSnapshot(
  db: DbExecutorT,
  snapshotId: number,
): Promise<{ investmentId: number; payload: StoredSnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT s.investment_id, s.schema_version, s.payload
    FROM kosztorys_snapshots s
    JOIN investments i ON i.id = s.investment_id
    WHERE s.id = ${snapshotId}
      AND s.template_preset_id IS NOT DISTINCT FROM i.template_preset_id
  `)
  const row = res.rows[0]
  if (!row) return null
  assertReadableSchemaVersion(Number(row.schema_version), 'snapshot')
  return { investmentId: Number(row.investment_id), payload: row.payload as StoredSnapshotPayloadT }
}

export async function listSnapshots(
  db: DbExecutorT,
  investmentId: number,
): Promise<SnapshotMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, investment_id, kind, label, taken_at, taken_by
    FROM kosztorys_snapshots
    WHERE investment_id = ${investmentId}
      AND template_preset_id IS NOT DISTINCT FROM ${HELD_PRESET(investmentId)}
    ORDER BY taken_at DESC, id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    investmentId: Number(row.investment_id),
    kind: row.kind as SnapshotKindT,
    label: (row.label as string | null) ?? null,
    takenAt: String(row.taken_at),
    takenBy: row.taken_by == null ? null : Number(row.taken_by),
  }))
}

const historyMeta = (row: Record<string, unknown>): HistoryMetaT => ({
  id: Number(row.id),
  kind: row.kind as HistoryKindT,
  label: (row.label as string | null) ?? null,
  takenAt: new Date(row.taken_at as string | Date),
})

// What the investor's history can be built from: the newest `auto` and `daily` of each Warsaw day and
// every `named` one. The per-day cut happens here so a month of 10-min rows never reaches the app;
// which of a day's two rows wins is the history library's call, not SQL's. `manual` rows are the
// owner's pre-restore points and never leave this query.
// `HistoryKindT` in SQL. One fragment, because the list and the by-id read must agree: an id the list
// offers that the read refuses renders the present under a past version's link.
const IS_HISTORY_KIND = sql`kind IN ('auto', 'daily', 'named')`

export async function listHistoryMetas(
  db: DbExecutorT,
  investmentId: number,
): Promise<HistoryMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, kind, label, taken_at FROM (
      SELECT id, kind, label, taken_at, row_number() OVER (
        PARTITION BY kind, date_trunc('day', taken_at AT TIME ZONE 'Europe/Warsaw')
        ORDER BY taken_at DESC, id DESC
      ) AS rn
      FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
        AND ${IS_HISTORY_KIND}
        AND template_preset_id IS NOT DISTINCT FROM ${HELD_PRESET(investmentId)}
    ) ranked
    WHERE kind = 'named' OR rn = 1
    ORDER BY taken_at, id
  `)
  return res.rows.map(historyMeta)
}

// The ids arrive from a URL, and an id from another investment or a `manual` row must be
// indistinguishable from one that doesn't exist.
export async function getHistorySnapshots(
  db: DbExecutorT,
  investmentId: number,
  ids: readonly number[],
): Promise<Map<number, HistoryMetaT & { payload: StoredSnapshotPayloadT }>> {
  if (ids.length === 0) return new Map()
  const res = await db.execute(sql`
    SELECT id, kind, label, taken_at, schema_version, payload
    FROM kosztorys_snapshots
    WHERE investment_id = ${investmentId}
      AND id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql.raw(', '),
      )})
      AND ${IS_HISTORY_KIND}
      AND template_preset_id IS NOT DISTINCT FROM ${HELD_PRESET(investmentId)}
  `)
  return new Map(
    res.rows.map((row) => {
      assertReadableSchemaVersion(Number(row.schema_version), 'snapshot')
      return [
        Number(row.id),
        { ...historyMeta(row), payload: row.payload as StoredSnapshotPayloadT },
      ]
    }),
  )
}

// Three statements rather than one, because each band is a separate sentence mapping 1:1 onto a test
// case. STATELESS and IDEMPOTENT — the set of survivors IS the state, so a missed cron night costs
// nothing and a second run deletes zero. The per-band breakdown is returned so the log says WHICH
// band deleted: a band firing when it should not is otherwise silent and irreversible.
export async function gcSnapshots(db: DbExecutorT): Promise<{
  deleted: number
  ceiling: number
  daily: number
  weekly: number
  investorExpired: number
}> {
  const ceiling = await db.execute(sql`
    DELETE FROM kosztorys_snapshots
    WHERE kind IN ('auto', 'manual')
      AND taken_at < now() - make_interval(days => ${MAX_AGE_DAYS})
    RETURNING id
  `)

  // A NULL completed_at fails the comparison, so it keeps.
  const investorExpired = await db.execute(sql`
    DELETE FROM kosztorys_snapshots s
    USING investments i
    WHERE i.id = s.investment_id
      AND s.kind IN ('daily', 'named')
      AND i.status = ${LOCKED_INVESTMENT_STATUS}
      AND i.completed_at < now() - make_interval(days => ${INVESTOR_HISTORY_DAYS_AFTER_COMPLETION})
    RETURNING s.id
  `)

  // The only date bucketing done in SQL in this repo (every other is JS, src/lib/utils/days.ts): the
  // sweep has to decide what to delete WITHOUT shipping every row to the app, so don't „fix" it into
  // the JS convention. Warsaw and not UTC because `taken_at` is timestamptz — editing at 00:30 would
  // otherwise land in the previous calendar day.
  const daily = await db.execute(sql`
    DELETE FROM kosztorys_snapshots WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY investment_id, date_trunc('day', taken_at AT TIME ZONE 'Europe/Warsaw')
          ORDER BY taken_at DESC, id DESC
        ) AS rn
        FROM kosztorys_snapshots
        WHERE kind = 'auto'
          AND taken_at < now() - make_interval(days => ${FULL_DENSITY_DAYS})
          AND taken_at >= now() - make_interval(days => ${DAILY_BAND_DAYS})
      ) ranked WHERE rn > 1
    )
    RETURNING id
  `)

  const weekly = await db.execute(sql`
    DELETE FROM kosztorys_snapshots WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY investment_id, date_trunc('week', taken_at AT TIME ZONE 'Europe/Warsaw')
          ORDER BY taken_at DESC, id DESC
        ) AS rn
        FROM kosztorys_snapshots
        WHERE kind = 'auto'
          AND taken_at < now() - make_interval(days => ${DAILY_BAND_DAYS})
      ) ranked WHERE rn > 1
    )
    RETURNING id
  `)

  const counts = {
    ceiling: ceiling.rows.length,
    daily: daily.rows.length,
    weekly: weekly.rows.length,
    investorExpired: investorExpired.rows.length,
  }
  return {
    deleted: counts.ceiling + counts.daily + counts.weekly + counts.investorExpired,
    ...counts,
  }
}
