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
import { isoOrNull } from './row-coerce'

// The single reader/writer of the raw kosztorys_presets table (no Payload collection — the
// notification_reads pattern). A preset is a GLOBAL, cross-investment template: a stripped kosztorys
// tree in `payload` jsonb, same shape as a snapshot. `name` is its identity, UNIQUE.

// Without the jsonb `payload`: a picker must never load the full tree for every preset.
export type PresetMetaT = {
  id: number
  name: string
  createdAt: string
  createdBy: number | null
}

// One row per section across ALL presets. `sectionId` is the section's id INSIDE the preset payload,
// paired with `presetId` so the append action can resolve it back — never a live sections id.
export type PresetSectionMetaT = {
  presetId: number
  presetName: string
  sectionId: number
  sectionName: string
  itemCount: number
}

// `ON CONFLICT DO NOTHING` returns no row on a duplicate name, so the caller words the message
// without sniffing PG error shapes — and race-free, since the UNIQUE(name) constraint is the arbiter.
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

// Leaves the id and created_at stable. Kosztorysy spawned from it stay frozen — there is no FK back
// to the preset.
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

// An UPDATE and not an upsert: the workbench's „Zapisz" must never resurrect a szablon someone
// deleted while it was open, and `false` is how the caller learns the row is gone.
export async function updatePresetPayload(
  db: DbExecutorT,
  params: { id: number; createdBy: number | null; payload: SnapshotPayloadT },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE kosztorys_presets SET
      schema_version = ${SNAPSHOT_SCHEMA_VERSION},
      payload = ${JSON.stringify(params.payload)}::jsonb,
      created_by = ${params.createdBy}
    WHERE id = ${params.id}
    RETURNING id
  `)
  return res.rows.length > 0
}

// The seed path resolves the payload from the row itself rather than trusting a client-passed value.
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

// Separate from `getPreset` because the workbench page needs a title only, and the payload is the one
// large column in this table.
export async function getPresetName(db: DbExecutorT, presetId: number): Promise<string | null> {
  const res = await db.execute(sql`SELECT name FROM kosztorys_presets WHERE id = ${presetId}`)
  const row = res.rows[0]
  return row ? String(row.name) : null
}

// Counted in SQL (EX-622): this needs nothing from the payloads but a tally, so shipping them to Node
// would decode megabytes for a few hundred small metas on every `presets` cache miss.
//
// The `counts` CTE expands `items` ONCE per preset. Counting inside the section-row lateral would
// re-expand the array per section — measured 50× slower on a 2-preset/320-item library.
//
// `WITH ORDINALITY` is load-bearing: Postgres' sort is unstable where JS's `.sort` was, and the
// picker's grouping needs one preset's metas CONSECUTIVELY, so the array position breaks ties.
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

// No versioning, no trash. A spawned kosztorys is a frozen copy, not a reference, so nothing
// downstream breaks; the one FK here, `investments.template_preset_id`, is ON DELETE SET NULL, so
// deleting a szablon somebody has open empties the warsztat's pointer instead of dangling it.
export async function deletePreset(db: DbExecutorT, presetId: number): Promise<boolean> {
  const res = await db.execute(sql`
    DELETE FROM kosztorys_presets WHERE id = ${presetId} RETURNING id
  `)
  return res.rows.length > 0
}

// The collision guard sits in SQL rather than in a catch on PG 23505, or the UNIQUE constraint
// surfaces as the driver's English sentence in a Polish UI. `false` = the name is taken or the id is
// gone — both mean „nothing was renamed", and the caller tells them apart by having listed the row.
export async function renamePreset(
  db: DbExecutorT,
  presetId: number,
  name: string,
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE kosztorys_presets SET name = ${name}
    WHERE id = ${presetId}
      AND NOT EXISTS (SELECT 1 FROM kosztorys_presets WHERE name = ${name} AND id <> ${presetId})
    RETURNING id
  `)
  return res.rows.length > 0
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
    createdAt: isoOrNull(row.created_at) ?? '',
    createdBy: row.created_by == null ? null : Number(row.created_by),
  }))
}
