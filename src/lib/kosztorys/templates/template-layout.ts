import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { TemplateSnapshotPayloadT } from './snapshot-payload'

const byDisplayOrder = (
  a: { displayOrder: number; id: number },
  b: { displayOrder: number; id: number },
) => a.displayOrder - b.displayOrder || a.id - b.id

// A kosztorys tree reduced to what a szablon keeps: sections in order and the katalog id of each
// praca. A praca with no katalog id has nothing to point at and is dropped — the caller filters
// those first so it can count them into its warning.
export function toTemplateLayout(tree: SnapshotPayloadT): TemplateSnapshotPayloadT {
  const sections = [...tree.sections].sort(byDisplayOrder)
  return {
    sections: sections.map((section) => ({
      name: section.name,
      color: section.color ?? null,
      catalogueItemIds: tree.items
        .filter((item) => item.sectionId === section.id && item.catalogueItemId != null)
        .sort(byDisplayOrder)
        .map((item) => item.catalogueItemId as number),
    })),
  }
}
