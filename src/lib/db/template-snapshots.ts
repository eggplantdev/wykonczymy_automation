import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { DAILY_BAND_DAYS, FULL_DENSITY_DAYS, MAX_AGE_DAYS } from '@/lib/db/snapshots'
import { assertReadableSchemaVersion, type SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import {
  TEMPLATE_SNAPSHOT_SCHEMA_VERSION,
  type TemplateSnapshotPayloadT,
} from '@/lib/kosztorys/templates/snapshot-payload'
import type { DbExecutorT } from './get-db'

// The raw `template_snapshots` table — a szablon's „Wersje", refs only. Retention follows the
// kosztorys bands (`gcSnapshots`), minus the investor clause: a szablon has no investor and is never
// completed, so a `named` version lives as long as the szablon does.

export type TemplateSnapshotMetaT = {
  id: number
  templateId: number
  kind: SnapshotKindT
  label: string | null
  takenAt: string
  takenBy: number | null
}

export async function insertTemplateSnapshot(
  db: DbExecutorT,
  params: {
    templateId: number
    kind: SnapshotKindT
    label: string | null
    takenBy: number | null
    payload: TemplateSnapshotPayloadT
  },
): Promise<number> {
  const res = await db.execute(sql`
    INSERT INTO template_snapshots (template_id, kind, label, taken_by, schema_version, payload)
    VALUES (
      ${params.templateId}, ${params.kind}, ${params.label}, ${params.takenBy},
      ${TEMPLATE_SNAPSHOT_SCHEMA_VERSION}, ${JSON.stringify(params.payload)}::jsonb
    )
    RETURNING id
  `)
  return Number(res.rows[0].id)
}

export async function listTemplateSnapshots(
  db: DbExecutorT,
  templateId: number,
): Promise<TemplateSnapshotMetaT[]> {
  const res = await db.execute(sql`
    SELECT id, template_id, kind, label, taken_at, taken_by
    FROM template_snapshots
    WHERE template_id = ${templateId}
    ORDER BY taken_at DESC, id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    templateId: Number(row.template_id),
    kind: row.kind as SnapshotKindT,
    label: (row.label as string | null) ?? null,
    takenAt: String(row.taken_at),
    takenBy: row.taken_by == null ? null : Number(row.taken_by),
  }))
}

export async function getTemplateSnapshot(
  db: DbExecutorT,
  snapshotId: number,
): Promise<{ templateId: number; payload: TemplateSnapshotPayloadT } | undefined> {
  const res = await db.execute(sql`
    SELECT template_id, schema_version, payload FROM template_snapshots WHERE id = ${snapshotId}
  `)
  const row = res.rows[0]
  if (!row) return undefined
  assertReadableSchemaVersion(Number(row.schema_version), 'snapshot')
  return {
    templateId: Number(row.template_id),
    payload: row.payload as TemplateSnapshotPayloadT,
  }
}

export async function gcTemplateSnapshots(
  db: DbExecutorT,
): Promise<{ deleted: number; ceiling: number; daily: number; weekly: number }> {
  const ceiling = await db.execute(sql`
    DELETE FROM template_snapshots
    WHERE kind IN ('auto', 'manual')
      AND taken_at < now() - make_interval(days => ${MAX_AGE_DAYS})
    RETURNING id
  `)

  const daily = await db.execute(sql`
    DELETE FROM template_snapshots WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY template_id, date_trunc('day', taken_at AT TIME ZONE 'Europe/Warsaw')
          ORDER BY taken_at DESC, id DESC
        ) AS rn
        FROM template_snapshots
        WHERE kind = 'auto'
          AND taken_at < now() - make_interval(days => ${FULL_DENSITY_DAYS})
          AND taken_at >= now() - make_interval(days => ${DAILY_BAND_DAYS})
      ) ranked WHERE rn > 1
    )
    RETURNING id
  `)

  const weekly = await db.execute(sql`
    DELETE FROM template_snapshots WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY template_id, date_trunc('week', taken_at AT TIME ZONE 'Europe/Warsaw')
          ORDER BY taken_at DESC, id DESC
        ) AS rn
        FROM template_snapshots
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
