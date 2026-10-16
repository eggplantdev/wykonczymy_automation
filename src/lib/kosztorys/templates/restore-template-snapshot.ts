import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { existingCatalogueIds } from '@/lib/db/work-catalogue'
import { replaceTemplateLayout } from './replace-template-layout'
import type { TemplateSnapshotPayloadT } from './snapshot-payload'

// A version holds katalog ids only, so a praca whose katalog entry has since been deleted has
// nothing left to render and is skipped; the count goes back to the owner as a warning.
export async function restoreTemplateSnapshot(
  db: DbExecutorT,
  templateId: number,
  payload: TemplateSnapshotPayloadT,
  takenBy: number,
): Promise<{ skippedCatalogueItems: number }> {
  const referenced = [...new Set(payload.sections.flatMap((section) => section.catalogueItemIds))]
  const existing = await existingCatalogueIds(db, referenced)

  let skippedCatalogueItems = 0
  const layout: TemplateSnapshotPayloadT = {
    sections: payload.sections.map((section) => {
      const kept = section.catalogueItemIds.filter((id) => existing.has(id))
      skippedCatalogueItems += section.catalogueItemIds.length - kept.length
      return { ...section, catalogueItemIds: kept }
    }),
  }

  await replaceTemplateLayout(db, templateId, { kind: 'auto', label: null, takenBy, layout })
  return { skippedCatalogueItems }
}
