import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { DbExecutorT } from './get-db'

// The single place that reads/writes the raw kosztorys_presets table (no Payload collection —
// the notification_reads pattern). A preset is a reusable, GLOBAL (cross-investment) template:
// a stripped kosztorys tree stored as `payload` jsonb (same shape as a snapshot). `name` is the
// preset's identity — UNIQUE, so save-as either inserts a new name or overwrites an existing one.

// List/attribution metadata — deliberately WITHOUT the jsonb `payload` (a picker must never load
// the full tree for every preset).
export type PresetMetaT = {
  id: number
  name: string
  createdAt: string
  createdBy: number | null
}

// Save a preset under a NEW name. `ON CONFLICT DO NOTHING` makes the duplicate-name case return no
// row → null, so the caller maps it to a friendly message WITHOUT sniffing driver-specific PG error
// shapes (and it's race-free — the UNIQUE(name) constraint is the arbiter, not a prior SELECT).
export async function insertPreset(
  db: DbExecutorT,
  params: { name: string; createdBy: number | null; payload: SnapshotPayloadT },
): Promise<number | null> {
  const res = await db.execute(sql`
    INSERT INTO kosztorys_presets (name, schema_version, payload, created_by)
    VALUES (
      ${params.name}, ${SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb,
      ${params.createdBy}
    )
    ON CONFLICT (name) DO NOTHING
    RETURNING id
  `)
  const row = res.rows[0]
  return row ? Number(row.id) : null
}

// Overwrite the preset with this name in place (or create it if absent). Retargets the payload +
// schema_version + author; leaves the id and created_at stable so spawned kosztorysy stay frozen
// (no FK back to the preset — retroactivity is not our concern here, the whole-slice snapshot rule).
export async function upsertPresetByName(
  db: DbExecutorT,
  params: { name: string; createdBy: number | null; payload: SnapshotPayloadT },
): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO kosztorys_presets (name, schema_version, payload, created_by)
    VALUES (
      ${params.name}, ${SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb,
      ${params.createdBy}
    )
    ON CONFLICT (name) DO UPDATE SET
      schema_version = EXCLUDED.schema_version,
      payload = EXCLUDED.payload,
      created_by = EXCLUDED.created_by
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

// Load one preset's full payload by id — the seed path resolves the payload from the row itself
// rather than trusting a client-passed value. Returns null when the id doesn't exist.
export async function getPreset(
  db: DbExecutorT,
  presetId: number,
): Promise<{ payload: SnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT payload FROM kosztorys_presets WHERE id = ${presetId}
  `)
  const row = res.rows[0]
  if (!row) return null
  return { payload: row.payload as SnapshotPayloadT }
}

export async function listPresets(db: DbExecutorT): Promise<PresetMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, name, created_at, created_by
    FROM kosztorys_presets
    ORDER BY created_at DESC, id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    createdBy: row.created_by == null ? null : Number(row.created_by),
  }))
}
