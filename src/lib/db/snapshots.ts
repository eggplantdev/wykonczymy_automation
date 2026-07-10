import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { DbExecutorT } from './get-db'

// The single place that reads/writes the raw kosztorys_snapshots table (no Payload collection —
// the notification_reads pattern). Retention has two independent bounds: an inline count cap kept
// hot on every auto insert (pruneAutoCount) and an age GC swept daily by the cron (gcSnapshots).

export type SnapshotKindT = 'manual' | 'auto'

// Newest-N auto snapshots kept per investment (inline cap). Manual snapshots are exempt.
const AUTO_KEEP = 50
// Age caps enforced by the daily GC — auto is ambient history, manual is a durable ~1-year net.
const AUTO_MAX_AGE_DAYS = 7
const MANUAL_MAX_AGE_DAYS = 365

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

// Keep only the newest AUTO_KEEP auto snapshots for the investment; manual rows are never touched.
export async function pruneAutoCount(db: DbExecutorT, investmentId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM kosztorys_snapshots
    WHERE investment_id = ${investmentId}
      AND kind = 'auto'
      AND id NOT IN (
        SELECT id FROM kosztorys_snapshots
        WHERE investment_id = ${investmentId} AND kind = 'auto'
        ORDER BY taken_at DESC, id DESC
        LIMIT ${AUTO_KEEP}
      )
  `)
}

// Load one snapshot's full payload by id (with its investment) — the restore path resolves the
// target investment from the row itself rather than trusting a client-passed value. Returns null
// when the id doesn't exist.
export async function getSnapshot(
  db: DbExecutorT,
  snapshotId: number,
): Promise<{ investmentId: number; payload: SnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT investment_id, payload FROM kosztorys_snapshots WHERE id = ${snapshotId}
  `)
  const row = res.rows[0]
  if (!row) return null
  return { investmentId: Number(row.investment_id), payload: row.payload as SnapshotPayloadT }
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

// Age-based global cleanup (daily cron): drop auto older than AUTO_MAX_AGE_DAYS and manual older than
// MANUAL_MAX_AGE_DAYS — including on dormant kosztorysy the inline count cap never revisits. Returns
// the number deleted for the cron summary.
export async function gcSnapshots(db: DbExecutorT): Promise<{ deleted: number }> {
  const res = await db.execute(sql`
    DELETE FROM kosztorys_snapshots
    WHERE (kind = 'auto' AND taken_at < now() - make_interval(days => ${AUTO_MAX_AGE_DAYS}))
       OR (kind = 'manual' AND taken_at < now() - make_interval(days => ${MANUAL_MAX_AGE_DAYS}))
    RETURNING id
  `)
  return { deleted: res.rows.length }
}
