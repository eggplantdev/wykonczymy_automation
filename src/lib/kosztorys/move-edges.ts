import { groupBySection } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

// Where ▲/▼ has nowhere to go: a praca at the edge of its section, a sekcja at the edge of the
// rozpiska. The movers already bail there, so a menu that doesn't read this offers a command that
// eats the click and changes nothing.
export type MoveEdgesT = {
  firstItemIds: ReadonlySet<number>
  lastItemIds: ReadonlySet<number>
  firstSectionId: number | undefined
  lastSectionId: number | undefined
}

// Section edges come off the list, not the rows: an itemless section at either end owns that edge
// and has no row to announce it.
export function computeMoveEdges(
  rows: KosztorysV2RowT[],
  sections: readonly SectionMetaT[],
): MoveEdgesT {
  const blocks = groupBySection(rows)
  const firstItemIds = new Set<number>()
  const lastItemIds = new Set<number>()
  for (const block of blocks.values()) {
    firstItemIds.add(block[0].id)
    lastItemIds.add(block[block.length - 1].id)
  }
  return {
    firstItemIds,
    lastItemIds,
    firstSectionId: sections[0]?.sectionId,
    lastSectionId: sections.at(-1)?.sectionId,
  }
}

// `edges` is optional so the read-only view — which computes none and shows no menu — answers here
// rather than at each call site.
export function canMoveItem(
  edges: MoveEdgesT | undefined,
  itemId: number,
  dir: 'up' | 'down',
): boolean {
  if (!edges) return false
  return dir === 'up' ? !edges.firstItemIds.has(itemId) : !edges.lastItemIds.has(itemId)
}

export function canMoveSection(
  edges: MoveEdgesT | undefined,
  sectionId: number,
  dir: 'up' | 'down',
): boolean {
  if (!edges) return false
  return dir === 'up' ? edges.firstSectionId !== sectionId : edges.lastSectionId !== sectionId
}
