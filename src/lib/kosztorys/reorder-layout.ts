import { z } from 'zod'

// An item's section is wherever it is listed, so a move across sections is the same write as one
// within a section.
export const kosztorysLayoutSchema = z
  .array(z.object({ sectionId: z.number().int(), itemIds: z.array(z.number().int()) }))
  .min(1)

export type KosztorysLayoutT = z.infer<typeof kosztorysLayoutSchema>

export const LAYOUT_STALE = 'Układ się zmienił w międzyczasie — odśwież i spróbuj ponownie.'

// Where a dragged block lands: before `beforeItemId` in that section, or at its end when undefined.
export type ItemDropTargetT = { sectionId: number; beforeItemId: number | undefined }

export type ReorderDragT = { kind: 'items' } | { kind: 'section'; sectionId: number }
export type ReorderDropT =
  | ({ kind: 'items' } & ItemDropTargetT)
  | { kind: 'section'; beforeSectionId: number | undefined }

// Under the pointer: a row, or a section header when `itemId` is undefined — for a section drag, the
// whole section block, so the line moves once per section rather than once per half-row.
export type ReorderHoverT = { sectionId: number; itemId: number | undefined; upperHalf: boolean }

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

export function resolveDropTarget(
  layout: KosztorysLayoutT,
  drag: ReorderDragT,
  hover: ReorderHoverT,
  collapsed: ReadonlySet<number>,
): ReorderDropT | undefined {
  const sectionIndex = layout.findIndex((section) => section.sectionId === hover.sectionId)
  const section = layout[sectionIndex]
  if (!section) return undefined
  if (drag.kind === 'section') {
    const beforeSectionId = hover.upperHalf ? hover.sectionId : layout[sectionIndex + 1]?.sectionId
    return { kind: 'section', beforeSectionId }
  }
  if (hover.itemId === undefined) {
    // A header drops at the top of its section — or at the end of a folded one, whose rows can't
    // show where the line went.
    const beforeItemId = collapsed.has(hover.sectionId) ? undefined : section.itemIds[0]
    return { kind: 'items', sectionId: hover.sectionId, beforeItemId }
  }
  const at = section.itemIds.indexOf(hover.itemId)
  const beforeItemId = hover.upperHalf ? hover.itemId : section.itemIds[at + 1]
  return { kind: 'items', sectionId: hover.sectionId, beforeItemId }
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
