import { describe, expect, it } from 'vitest'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { columnsRevealedBy, countMatching } from '@/lib/kosztorys/row-conditions/queries'

const AI = { ...CTX, hasAiDraft: true }

describe('„Przegląd AI" diagnostics', () => {
  it('„do sprawdzenia" counts rows the agent priced and nobody judged yet, an equal Przedmiar judged', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: 12 }),
      row({ id: 2, aiPlannedQty: 12, reviewStatus: 'accepted' }),
      row({ id: 3, aiPlannedQty: 0 }),
      row({ id: 4, aiPlannedQty: null }),
      row({ id: 5, aiPlannedQty: 12, plannedQty: 12 }),
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

  it('reads a praca the agent never saw or left out, with a Przedmiar, as Dodana without a stored status', () => {
    const rows = [
      row({ id: 1, aiPlannedQty: null, plannedQty: 5 }),
      row({ id: 2, aiPlannedQty: null, plannedQty: 0 }),
      row({ id: 3, aiPlannedQty: 0, plannedQty: 1 }),
      row({ id: 4, aiPlannedQty: 0, plannedQty: 0 }),
    ]
    expect(countMatching(rows, 'ai-without-reason', AI)).toBe(2)
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

  it('the „Filtry" pair splits rows on Przedmiar OR AI przedmiar', () => {
    const rows = [
      row({ id: 1, plannedQty: 5, aiPlannedQty: 0 }),
      row({ id: 2, plannedQty: 0, aiPlannedQty: 3 }),
      row({ id: 3, plannedQty: 0, aiPlannedQty: 0 }),
      row({ id: 4, plannedQty: 0, aiPlannedQty: null }),
    ]
    const shown = { ...AI, aiColumnsShown: true }
    expect(countMatching(rows, 'has-planned-or-ai-qty', shown)).toBe(2)
    expect(countMatching(rows, 'no-planned-or-ai-qty', shown)).toBe(2)
  })

  it('the „Filtry" pair matches nothing outside „Przegląd AI", so the menu does not list it', () => {
    const rows = [row({ id: 1, plannedQty: 5 }), row({ id: 2, plannedQty: 0, aiPlannedQty: 3 })]
    for (const ctx of [CTX, AI]) {
      expect(countMatching(rows, 'has-planned-or-ai-qty', ctx)).toBe(0)
      expect(countMatching(rows, 'no-planned-or-ai-qty', ctx)).toBe(0)
    }
  })

  it('both reveal the AI columns', () => {
    expect(columnsRevealedBy(['ai-to-review'])).toEqual(new Set(AI_REVIEW_COLUMN_IDS))
    expect(columnsRevealedBy(['ai-without-reason'])).toEqual(new Set(AI_REVIEW_COLUMN_IDS))
  })
})
