import { describe, expect, it } from 'vitest'
import { canMoveItem, canMoveSection, computeMoveEdges } from '@/lib/kosztorys/move-edges'
import { sectionNeighbor } from '@/lib/kosztorys/row-ops'
import { swapSection } from '@/lib/kosztorys/section-list'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

function meta(sectionId: number): SectionMetaT {
  return { sectionId, sectionName: `Sekcja ${sectionId}`, sectionColor: null }
}

// Section 1 = [1,2,3], section 2 = [4], section 3 = [5,6] — with section 1's last row parked at the
// end of the array, because neither mover reads block contiguity and neither may this.
const rows = [row(1, 1), row(2, 1), row(4, 2), row(5, 3), row(6, 3), row(3, 1)]
const sections = [meta(1), meta(2), meta(3)]
const directions: ('up' | 'down')[] = ['up', 'down']

describe('move edges', () => {
  // An enabled command must be exactly a command that moves something — read apart, the menu and the
  // mover drift and the user gets a live ▲ that does nothing.
  it('enables a praca ▲/▼ exactly where the mover finds a neighbour', () => {
    const edges = computeMoveEdges(rows, sections)
    for (const item of rows) {
      for (const dir of directions) {
        expect(canMoveItem(edges, item.id, dir)).toBe(
          sectionNeighbor(rows, item.id, dir) !== undefined,
        )
      }
    }
  })

  it('enables a sekcja ▲/▼ exactly where the mover finds a neighbour', () => {
    const edges = computeMoveEdges(rows, sections)
    for (const { sectionId } of sections) {
      for (const dir of directions) {
        expect(canMoveSection(edges, sectionId, dir)).toBe(
          swapSection(sections, sectionId, dir) !== null,
        )
      }
    }
  })

  it('leaves a lone praca in its section stuck in both directions', () => {
    const edges = computeMoveEdges(rows, sections)
    expect(canMoveItem(edges, 4, 'up')).toBe(false)
    expect(canMoveItem(edges, 4, 'down')).toBe(false)
  })

  it('reads the ends off the section order, not off array position', () => {
    const edges = computeMoveEdges(rows, sections)
    expect(edges.firstSectionId).toBe(1)
    expect(edges.lastSectionId).toBe(3)
    expect(edges.firstItemIds).toEqual(new Set([1, 4, 5]))
    expect(edges.lastItemIds).toEqual(new Set([3, 4, 6]))
  })

  // No row carries its id, so an edge read off the rows would hand it to the populated neighbour and
  // offer that one a ▲ that moves nothing.
  it('gives the edge to an itemless section at either end', () => {
    const edges = computeMoveEdges(rows, [meta(7), ...sections, meta(8)])
    expect(edges.firstSectionId).toBe(7)
    expect(edges.lastSectionId).toBe(8)
    expect(canMoveSection(edges, 1, 'up')).toBe(true)
    expect(canMoveSection(edges, 3, 'down')).toBe(true)
  })
})
