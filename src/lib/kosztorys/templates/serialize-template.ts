import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectTemplateTreeData } from '@/lib/db/template-tree'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// `undefined` when the szablon does not exist.
export async function serializeTemplate(
  db: DbExecutorT,
  templateId: number,
): Promise<SnapshotPayloadT | undefined> {
  const data = await selectTemplateTreeData(db, templateId)
  if (!data) return undefined

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: data.sections,
    items: data.items,
    stages: [],
    progress: [],
    settings: {
      wToolsCoeff: DEFAULT_COEFFS.wTools,
      ownToolsCoeff: DEFAULT_COEFFS.ownTools,
      vatRate: DEFAULT_VAT,
    },
  }
}
