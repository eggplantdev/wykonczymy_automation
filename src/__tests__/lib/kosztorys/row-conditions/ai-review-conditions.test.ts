import { describe, expect, it } from 'vitest'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { columnsRevealedBy, countMatching } from '@/lib/kosztorys/row-conditions/queries'

const AI = { ...CTX, hasAiDraft: true }

describe('„Przegląd AI" diagnostics', () => {
  it('„do sprawdzenia" counts rows the agent priced and nobody judged yet', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: 12 }),
      row({ id: 2, aiPlannedQty: 12, reviewStatus: 'accepted' }),
      row({ id: 3, aiPlannedQty: 0 }),
      row({ id: 4, aiPlannedQty: null }),
    ]
    expect(countMatching(rows, 'ai-to-review', AI)).toBe(1)
  })

  it('„zmienione bez powodu" counts a non-accepted verdict with a blank Powód zmiany', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: 12, reviewStatus: 'edited', changeReason: '  ' }),
      row({ id: 2, aiPlannedQty: 12, reviewStatus: 'rejected', changeReason: null }),
      row({ id: 3, aiPlannedQty: 12, reviewStatus: 'edited', changeReason: 'za mało' }),
      row({ id: 4, aiPlannedQty: 12, reviewStatus: 'accepted', changeReason: null }),
    ]
    expect(countMatching(rows, 'ai-without-reason', AI)).toBe(2)
  })

  it('reads a praca the agent never saw, with a Przedmiar, as Dodana without a stored status', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: null, plannedQty: 5 }),
      row({ id: 2, aiPlannedQty: null, plannedQty: 0 }),
    ]
    expect(countMatching(rows, 'ai-without-reason', AI)).toBe(1)
  })

  it('both match nothing without an AI draft', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: 12 }),
      row({ id: 2, aiPlannedQty: 12, reviewStatus: 'edited' }),
      row({ id: 3, aiPlannedQty: null, plannedQty: 5 }),
    ]
    for (const ctx of [CTX, { ...CTX, hasAiDraft: false }]) {
      expect(countMatching(rows, 'ai-to-review', ctx)).toBe(0)
      expect(countMatching(rows, 'ai-without-reason', ctx)).toBe(0)
    }
  })

  it('both reveal the AI columns', () => {
    expect(columnsRevealedBy(['ai-to-review'])).toEqual(new Set(AI_REVIEW_COLUMN_IDS))
    expect(columnsRevealedBy(['ai-without-reason'])).toEqual(new Set(AI_REVIEW_COLUMN_IDS))
  })
})
