import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  SNAPSHOT_SCHEMA_VERSION,
  assertReadableSchemaVersion,
  type SnapshotPayloadT,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { DbExecutorT } from './get-db'

// The single reader/writer of the raw kosztorys_snapshots table (no Payload collection — the
// notification_reads pattern). Retention has one authority, gcSnapshots, swept daily by the cron;
// nothing prunes on the insert path, so a capture is a plain INSERT.

export type SnapshotKindT = 'manual' | 'auto'

// THE RETENTION POLICY, in full:
//
//   0–30 days    every snapshot survives (~10 min apart while someone is editing)
//   30–120 days  one per calendar day
//   120–365 days one per calendar week
//   past 365     gone, auto and manual alike
//
// The survivor of a bucket is its NEWEST row — how the work was left that day/week, not how it
// started. Manual snapshots are exempt from both bands, bounded only by MAX_AGE_DAYS.
const FULL_DENSITY_DAYS = 30
const DAILY_BAND_DAYS = 120
const MAX_AGE_DAYS = 365

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
// from the investment row so no caller can forget it, and so „Przed wczytaniem", taken before the
// pointer moves, is attributed to the szablon it holds.
const HELD_PRESET = (investmentId: number) =>
  sql`(SELECT "template_preset_id" FROM investments WHERE id = ${investmentId})`

export async function insertSnapshot(
  db: DbExecutorT,
  params: {
    investmentId: number
    kind: SnapshotKindT
    label: string | null
    takenBy: number | null
    payload: SnapshotPayloadT
  },
): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO kosztorys_snapshots (
      investment_id, kind, label, taken_by, schema_version, payload, template_preset_id
    )
    VALUES (
      ${params.investmentId}, ${params.kind}, ${params.label}, ${params.takenBy},
      ${SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb,
      ${HELD_PRESET(params.investmentId)}
    )
    RETURNING id
  `)
  return Number(res.rows[0].id)
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

// Three statements rather than one, because each band is a separate sentence mapping 1:1 onto a test
// case. STATELESS and IDEMPOTENT — the set of survivors IS the state, so a missed cron night costs
// nothing and a second run deletes zero. The per-band breakdown is returned so the log says WHICH
// band deleted: a band firing when it should not is otherwise silent and irreversible.
export async function gcSnapshots(
  db: DbExecutorT,
): Promise<{ deleted: number; ceiling: number; daily: number; weekly: number }> {
  const ceiling = await db.execute(sql`
    DELETE FROM kosztorys_snapshots
    WHERE taken_at < now() - make_interval(days => ${MAX_AGE_DAYS})
    RETURNING id
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
  }
  return { deleted: counts.ceiling + counts.daily + counts.weekly, ...counts }
}
