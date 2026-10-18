import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// `dropRef`: a szablon mints new refs, so for a preset `ref` is an identity like `id`.
export function canonicalTree(snap: StoredSnapshotPayloadT, { dropRef = false } = {}) {
  const sectionById = new Map(snap.sections.map((section) => [section.id, section]))
  const itemById = new Map(snap.items.map((item) => [item.id, item]))
  const stageById = new Map(snap.stages.map((stage) => [stage.id, stage]))
  const sectionOrder = (sectionId: number) => sectionById.get(sectionId)!.displayOrder ?? 0

  const sections = [...snap.sections]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map(({ id: _id, ...rest }) => rest)

  const items = snap.items
    .map(({ id: _id, ref, sectionId, ...rest }) => ({
      sectionOrder: sectionOrder(sectionId),
      ...(dropRef ? {} : { ref }),
      ...rest,
    }))
    .sort(
      (a, b) => a.sectionOrder - b.sectionOrder || (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    )

  const stages = [...snap.stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(({ id: _id, ...rest }) => rest)

  const progress = snap.progress
    .map((entry) => {
      const item = itemById.get(entry.itemId)!
      return {
        sectionOrder: sectionOrder(item.sectionId),
        itemOrder: item.displayOrder ?? 0,
        stageOrdinal: stageById.get(entry.stageId)!.ordinal,
        qtyDone: entry.qtyDone,
      }
    })
    .sort(
      (a, b) =>
        a.sectionOrder - b.sectionOrder ||
        a.itemOrder - b.itemOrder ||
        a.stageOrdinal - b.stageOrdinal,
    )

  return { sections, items, stages, progress }
}
