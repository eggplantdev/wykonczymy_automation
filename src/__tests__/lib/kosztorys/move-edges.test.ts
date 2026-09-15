import { describe, expect, it } from 'vitest'
import { canMoveItem, canMoveSection, computeMoveEdges } from '@/lib/kosztorys/move-edges'
import { neighborSectionId, sectionNeighbor } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

// Section 1 = [1,2,3], section 2 = [4], section 3 = [5,6] — with section 1's last row parked at the
// end of the array, because neither mover reads block contiguity and neither may this.
const rows = [row(1, 1), row(2, 1), row(4, 2), row(5, 3), row(6, 3), row(3, 1)]
const sectionIds = [1, 2, 3]
const directions: ('up' | 'down')[] = ['up', 'down']

describe('move edges', () => {
  // The bridge: an enabled command must be exactly a command that moves something. Read apart, the
  // menu and the mover drift and the user gets a live ▲ that silently does nothing.
  it('enables a praca ▲/▼ exactly where the mover finds a neighbour', () => {
    const edges = computeMoveEdges(rows)
    for (const item of rows) {
      for (const dir of directions) {
        expect(canMoveItem(edges, item.id, dir)).toBe(
          sectionNeighbor(rows, item.id, dir) !== undefined,
        )
      }
    }
  })

  it('enables a sekcja ▲/▼ exactly where the mover finds a neighbour', () => {
    const edges = computeMoveEdges(rows)
    for (const sectionId of sectionIds) {
      for (const dir of directions) {
        expect(canMoveSection(edges, sectionId, dir)).toBe(
          neighborSectionId(rows, sectionId, dir) !== undefined,
        )
      }
    }
  })

  it('leaves a lone praca in its section stuck in both directions', () => {
    const edges = computeMoveEdges(rows)
    expect(canMoveItem(edges, 4, 'up')).toBe(false)
    expect(canMoveItem(edges, 4, 'down')).toBe(false)
  })

  it('reads the ends off the section order, not off array position', () => {
    const edges = computeMoveEdges(rows)
    expect(edges.firstSectionId).toBe(1)
    expect(edges.lastSectionId).toBe(3)
    expect(edges.firstItemIds).toEqual(new Set([1, 4, 5]))
    expect(edges.lastItemIds).toEqual(new Set([3, 4, 6]))
  })
})
