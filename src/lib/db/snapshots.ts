import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  SNAPSHOT_SCHEMA_VERSION,
  assertReadableSchemaVersion,
  type SnapshotPayloadT,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { DbExecutorT } from './get-db'

// The single place that reads/writes the raw kosztorys_snapshots table (no Payload collection —
// the notification_reads pattern). Retention has exactly one authority: gcSnapshots, swept daily by
// the cron. Nothing prunes on the insert path, so a capture is a plain INSERT.

export type SnapshotKindT = 'manual' | 'auto'

// THE RETENTION POLICY, in full:
//
//   0–30 days    every snapshot survives (~10 min apart while someone is editing)
//   30–120 days  one per calendar day
//   120–365 days one per calendar week
//   past 365     gone, auto and manual alike
//
// The survivor of a bucket is its NEWEST row — the state the work was left in that day/week, not the
// state it was started from. Manual snapshots are exempt from both bands and bounded only by
// MAX_AGE_DAYS.
const FULL_DENSITY_DAYS = 30
const DAILY_BAND_DAYS = 120
const MAX_AGE_DAYS = 365

// List/attribution metadata — deliberately WITHOUT the jsonb `payload` (a list must never load ~1000
// rows × N snapshots of tree data).
export type SnapshotMetaT = {
  id: number
  investmentId: number
  kind: SnapshotKindT
  label: string | null
  takenAt: string
  takenBy: number | null
}

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
    INSERT INTO kosztorys_snapshots (investment_id, kind, label, taken_by, schema_version, payload)
    VALUES (
      ${params.investmentId}, ${params.kind}, ${params.label}, ${params.takenBy},
      ${SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb
    )
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

// Load one snapshot's full payload by id (with its investment) — the restore path resolves the
// target investment from the row itself rather than trusting a client-passed value. Returns null
// when the id doesn't exist.
export async function getSnapshot(
  db: DbExecutorT,
  snapshotId: number,
): Promise<{ investmentId: number; payload: StoredSnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT investment_id, schema_version, payload FROM kosztorys_snapshots WHERE id = ${snapshotId}
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

// Global retention sweep (daily cron). Three statements rather than one, because each band is a
// separate sentence and each maps 1:1 onto a test case. The sweep is STATELESS and IDEMPOTENT: the
// set of survivors in a bucket IS the state, so a missed cron night costs nothing and a second run
// in the same minute deletes zero. The per-band breakdown is returned so the cron log says WHICH
// band deleted — a band firing when it should not is otherwise silent and irreversible.
export async function gcSnapshots(
  db: DbExecutorT,
): Promise<{ deleted: number; ceiling: number; daily: number; weekly: number }> {
  const ceiling = await db.execute(sql`
    DELETE FROM kosztorys_snapshots
    WHERE taken_at < now() - make_interval(days => ${MAX_AGE_DAYS})
    RETURNING id
  `)

  // date_trunc(... AT TIME ZONE 'Europe/Warsaw') is the first date bucketing done in SQL in this repo
  // — every other one is JS (src/lib/utils/days.ts). It belongs in SQL here because the sweep must
  // decide what to delete WITHOUT shipping every row to the app; don't "fix" it into the JS
  // convention. Warsaw and not UTC because `taken_at` is timestamptz: editing at 00:30 would
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
