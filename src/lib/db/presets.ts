// No `server-only` here (half of src/lib/db skips it too): the katalog seed script runs `getPreset`
// under tsx, where that import throws.
import { sql } from '@payloadcms/db-vercel-postgres'
import {
  SNAPSHOT_SCHEMA_VERSION,
  assertReadableSchemaVersion,
  type SnapshotPayloadT,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
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

// One row per section across ALL presets — the "append a section from a szablon" picker's data.
// `sectionId` is the section's id INSIDE the preset payload (the OLD id), paired with `presetId` so
// the append action can resolve it back to the payload; never a live kosztorys_sections id.
export type PresetSectionMetaT = {
  presetId: number
  presetName: string
  sectionId: number
  sectionName: string
  itemCount: number
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
): Promise<{ name: string; payload: StoredSnapshotPayloadT } | null> {
  const res = await db.execute(sql`
    SELECT name, schema_version, payload FROM kosztorys_presets WHERE id = ${presetId}
  `)
  const row = res.rows[0]
  if (!row) return null
  assertReadableSchemaVersion(Number(row.schema_version), 'preset')
  return { name: String(row.name), payload: row.payload as StoredSnapshotPayloadT }
}

// Flatten every preset's sections into pickable metas. Counted in SQL on purpose (EX-622): the
// payloads are the only large thing here and this needs nothing from them but a tally, so shipping
// them to Node would be an O(payload bytes) read for an O(sections) result — megabytes decoded to
// emit a few hundred small metas, re-paid on every `presets` cache miss.
//
// The `counts` CTE expands `items` ONCE per preset and hashes the result. Counting inside the
// section-row lateral instead would re-expand the whole items array per section (O(sections×items)) —
// measured 50× slower on a 2-preset/320-item library, and it widens from there.
//
// Order matches listPresets (preset created_at DESC, id DESC) then displayOrder within each preset.
// `WITH ORDINALITY` is load-bearing, not decoration: Postgres' sort is unstable where JS's `.sort`
// was, and the picker's grouping requires one preset's metas to arrive CONSECUTIVELY, so the payload
// array position has to break displayOrder ties.
export async function listPresetSections(db: DbExecutorT): Promise<PresetSectionMetaT[]> {
  const res = await db.execute(sql`
    WITH counts AS (
      SELECT p.id AS preset_id, i.value->>'sectionId' AS section_id, COUNT(*) AS item_count
      FROM kosztorys_presets p
      CROSS JOIN LATERAL jsonb_array_elements(p.payload->'items') i
      GROUP BY 1, 2
    )
    SELECT
      p.id                      AS preset_id,
      p.name                    AS preset_name,
      (s.value->>'id')::int     AS section_id,
      s.value->>'name'          AS section_name,
      COALESCE(c.item_count, 0) AS item_count
    FROM kosztorys_presets p
    CROSS JOIN LATERAL jsonb_array_elements(p.payload->'sections') WITH ORDINALITY AS s(value, ord)
    LEFT JOIN counts c ON c.preset_id = p.id AND c.section_id = s.value->>'id'
    ORDER BY p.created_at DESC, p.id DESC, (s.value->>'displayOrder')::numeric, s.ord
  `)
  return res.rows.map((row) => ({
    presetId: Number(row.preset_id),
    presetName: String(row.preset_name),
    sectionId: Number(row.section_id),
    sectionName: String(row.section_name),
    itemCount: Number(row.item_count),
  }))
}

// Delete a preset outright — no versioning, no trash. Referentially safe: nothing FKs into this
// table, and a kosztorys spawned from a preset is a frozen copy, not a reference. `false` = no such
// row, which the caller reports rather than swallowing.
export async function deletePreset(db: DbExecutorT, presetId: number): Promise<boolean> {
  const res = await db.execute(sql`
    DELETE FROM kosztorys_presets WHERE id = ${presetId} RETURNING id
  `)
  return res.rows.length > 0
}

// Rename in place. The collision guard sits in SQL rather than in a catch on PG 23505 for the same
// reason insertPreset's ON CONFLICT does: the UNIQUE constraint would otherwise surface as the
// driver's English sentence in a Polish UI. `null` = the name is taken (or the id doesn't exist —
// both mean "nothing was renamed", and the caller distinguishes them by having listed the row).
export async function renamePreset(
  db: DbExecutorT,
  presetId: number,
  name: string,
): Promise<number | null> {
  const res = await db.execute(sql`
    UPDATE kosztorys_presets SET name = ${name}
    WHERE id = ${presetId}
      AND NOT EXISTS (SELECT 1 FROM kosztorys_presets WHERE name = ${name} AND id <> ${presetId})
    RETURNING id
  `)
  const row = res.rows[0]
  return row ? Number(row.id) : null
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
