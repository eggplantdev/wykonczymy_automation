import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import {
  TEMPLATE_SNAPSHOT_SCHEMA_VERSION,
  type TemplateSnapshotPayloadT,
} from '@/lib/kosztorys/templates/snapshot-payload'
import type { DbExecutorT } from './get-db'

// The raw `template_snapshots` table — a szablon's „Wersje", refs only.

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
