import { groupBySection } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Where ▲/▼ has nowhere to go: a praca at the top or bottom of its own section, a sekcja at the top
// or bottom of the rozpiska. The movers already bail there (`sectionNeighbor` / `neighborSectionId`
// come back undefined), so a menu that doesn't read this offers a command that eats the click and
// changes nothing — the same look-alive-do-nothing trap as the commands under a sort.
export type MoveEdgesT = {
  firstItemIds: ReadonlySet<number>
  lastItemIds: ReadonlySet<number>
  firstSectionId: number | undefined
  lastSectionId: number | undefined
}

// Both planes off one grouping pass, because both movers read the same thing: the order the sections
// and their rows appear in `rows`, never block contiguity.
export function computeMoveEdges(rows: KosztorysV2RowT[]): MoveEdgesT {
  const blocks = groupBySection(rows)
  const firstItemIds = new Set<number>()
  const lastItemIds = new Set<number>()
  for (const block of blocks.values()) {
    firstItemIds.add(block[0].id)
    lastItemIds.add(block[block.length - 1].id)
  }
  const sequence = [...blocks.keys()]
  return {
    firstItemIds,
    lastItemIds,
    firstSectionId: sequence[0],
    lastSectionId: sequence.at(-1),
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
