import { describe, expect, it } from 'vitest'
import { applyAddItem } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// applyAddItem only reads `id` and `sectionId`, so the rest of the row is irrelevant here.
function row(id: number, sectionId: number): KosztorysV2RowT {
  return { id, sectionId } as KosztorysV2RowT
}

const ids = (rows: KosztorysV2RowT[]) => rows.map((r) => r.id)

// Three tidy blocks: section 1 = [1,2], section 2 = [3,4], section 3 = [5].
const contiguous = [row(1, 1), row(2, 1), row(3, 2), row(4, 2), row(5, 3)]

describe('applyAddItem', () => {
  it('lands the new row after the last row of its own section', () => {
    expect(ids(applyAddItem(contiguous, row(9, 1)))).toEqual([1, 2, 9, 3, 4, 5])
    expect(ids(applyAddItem(contiguous, row(9, 2)))).toEqual([1, 2, 3, 4, 9, 5])
  })

  it('appends when the section has no rows yet', () => {
    expect(ids(applyAddItem(contiguous, row(9, 42)))).toEqual([1, 2, 3, 4, 5, 9])
  })
})
