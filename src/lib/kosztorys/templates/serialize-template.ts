import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { selectTemplateTreeData } from '@/lib/db/template-tree'
import { DEFAULT_COEFFS, DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// A szablon as the payload the kosztorys writers already apply (seed, reload, append sections), its
// prace resolved from the katalog at this moment — the copy lands in the kosztorys, which keeps its
// own values from then on. `sectionIds` narrows it to the picked sections, in the szablon's order.
// `undefined` when the szablon does not exist.
export async function serializeTemplate(
  db: DbExecutorT,
  templateId: number,
  sectionIds?: readonly number[],
): Promise<SnapshotPayloadT | undefined> {
  const data = await selectTemplateTreeData(db, templateId)
  if (!data) return undefined

  const picked = sectionIds ? new Set(sectionIds) : undefined
  const sections = picked ? data.sections.filter((section) => picked.has(section.id)) : data.sections
  const kept = new Set(sections.map((section) => section.id))

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections,
    items: data.items.filter((item) => kept.has(item.sectionId)),
    stages: [],
    progress: [],
    settings: {
      wToolsCoeff: DEFAULT_COEFFS.wTools,
      ownToolsCoeff: DEFAULT_COEFFS.ownTools,
      vatRate: DEFAULT_VAT,
    },
  }
}
