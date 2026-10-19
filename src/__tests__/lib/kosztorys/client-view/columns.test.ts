import { describe, expect, it } from 'vitest'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import {
  CLIENT_DOCUMENT_COLUMNS,
  CLIENT_VIEW_GROUPS,
  PREVIEW_VISIBLE_COLUMNS,
} from '@/lib/kosztorys/client-view/columns'

describe('the client-view column groups', () => {
  const grouped = CLIENT_VIEW_GROUPS.flatMap((group) => group.keys)

  it('offers each allowlisted column exactly once', () => {
    expect(grouped).toHaveLength(PREVIEW_VISIBLE_COLUMNS.size)
    expect(new Set(grouped)).toEqual(new Set(PREVIEW_VISIBLE_COLUMNS))
  })

  it('names every row from the same source as the grid header', () => {
    for (const key of grouped) expect(COLUMN_LABELS[key]).toBeTypeOf('string')
  })

  it('offers the rabat on przedmiar under „Ceny i rabat", beside the rabat it explains', () => {
    const prices = CLIENT_VIEW_GROUPS.find((group) => group.label === 'Ceny i rabat')
    expect(prices?.keys).toContain('plannedDiscountAmount')
    const at = CLIENT_DOCUMENT_COLUMNS.indexOf('plannedDiscountAmount')
    expect(CLIENT_DOCUMENT_COLUMNS[at - 1]).toBe('discountType')
  })
})
