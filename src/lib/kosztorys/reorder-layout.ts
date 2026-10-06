import type { KosztorysLayoutT } from '@/lib/db/kosztorys-layout'

// Where a dragged block lands: before `beforeItemId` in that section, or at its end when undefined.
export type ItemDropTargetT = { sectionId: number; beforeItemId: number | undefined }

// Moves the block, keeping its rows in their current top-to-bottom order whichever sections they
// came from — the Excel „wytnij wiersze, wstaw wycięte" gesture. A target inside the block itself
// resolves to the first unmoved row after it, so dropping a block onto itself is a no-op.
export function moveItems(
  layout: KosztorysLayoutT,
  moved: ReadonlySet<number>,
  target: ItemDropTargetT,
): KosztorysLayoutT {
  const block = layout.flatMap((section) => section.itemIds.filter((id) => moved.has(id)))
  if (block.length === 0) return layout
  const targetSection = layout.find((section) => section.sectionId === target.sectionId)
  if (!targetSection) return layout

  let anchor: number | undefined
  if (target.beforeItemId !== undefined) {
    const from = targetSection.itemIds.indexOf(target.beforeItemId)
    anchor = targetSection.itemIds.slice(from).find((id) => !moved.has(id))
  }

  return layout.map((section) => {
    const kept = section.itemIds.filter((id) => !moved.has(id))
    if (section.sectionId !== target.sectionId) return { ...section, itemIds: kept }
    const at = anchor === undefined ? kept.length : kept.indexOf(anchor)
    return { ...section, itemIds: [...kept.slice(0, at), ...block, ...kept.slice(at)] }
  })
}

// `beforeSectionId` undefined → last.
export function moveSection(
  layout: KosztorysLayoutT,
  sectionId: number,
  beforeSectionId: number | undefined,
): KosztorysLayoutT {
  if (sectionId === beforeSectionId) return layout
  const moving = layout.find((section) => section.sectionId === sectionId)
  if (!moving) return layout
  const rest = layout.filter((section) => section.sectionId !== sectionId)
  const at =
    beforeSectionId === undefined
      ? rest.length
      : rest.findIndex((section) => section.sectionId === beforeSectionId)
  return [...rest.slice(0, at), moving, ...rest.slice(at)]
}

export function sameLayout(a: KosztorysLayoutT, b: KosztorysLayoutT): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
