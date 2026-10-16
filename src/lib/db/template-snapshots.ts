import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { gcRetentionBands, snapshotMetaOf } from '@/lib/db/snapshots'
import { assertReadableSchemaVersion, type SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import {
  TEMPLATE_SNAPSHOT_SCHEMA_VERSION,
  type TemplateSnapshotPayloadT,
} from '@/lib/kosztorys/templates/snapshot-payload'
import type { DbExecutorT } from './get-db'

// The raw `template_snapshots` table — a szablon's „Wersje", refs only. Retention follows the
// kosztorys bands (`gcRetentionBands`), minus the investor clause: a szablon has no investor and is never
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
  return res.rows.map((row) => ({ ...snapshotMetaOf(row), templateId: Number(row.template_id) }))
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
  const counts = await gcRetentionBands(db, 'template')
  return { deleted: counts.ceiling + counts.daily + counts.weekly, ...counts }
}
