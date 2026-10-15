import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { TemplateSnapshotPayloadT } from './snapshot-payload'

// A kosztorys tree reduced to what a szablon keeps: sections in order and the katalog id of each
// praca. A praca with no katalog id has nothing to point at and is dropped — the caller filters
// those first so it can count them into its warning.
export function toTemplateLayout(tree: SnapshotPayloadT): TemplateSnapshotPayloadT {
  const sections = [...tree.sections].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
  return {
    sections: sections.map((section) => ({
      name: section.name,
      color: section.color ?? null,
      catalogueItemIds: tree.items
        .filter((item) => item.sectionId === section.id && item.catalogueItemId != null)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
        .map((item) => item.catalogueItemId as number),
    })),
  }
}
