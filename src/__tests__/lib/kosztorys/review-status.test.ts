import { describe, expect, it } from 'vitest'
import {
  applyReviewRules,
  effectiveReviewStatus,
  hasAiDraft,
} from '@/lib/kosztorys/review-status'
import type { ReviewStatusT } from '@/lib/kosztorys/types'

type RowT = {
  id: number
  aiPlannedQty: number | null
  plannedQty: number
  reviewStatus: ReviewStatusT | null
}

const row = (overrides: Partial<RowT> = {}): RowT => ({
  id: 1,
  aiPlannedQty: 10,
  plannedQty: 0,
  reviewStatus: null,
  ...overrides,
})

const apply = (before: RowT, after: Partial<RowT>, aiDraft = true) =>
  applyReviewRules([{ ...before, ...after }], new Map([[before.id, before]]), aiDraft)[0]

describe('applyReviewRules — a typed Przedmiar sets the Status', () => {
  it.each([
    [10, 10, 'accepted'],
    [10, 0, 'rejected'],
    [10, 7, 'edited'],
    [0, 4, 'added'],
    [null, 4, 'added'],
    [0, 0, null],
    [null, 0, null],
  ] as const)('AI %s, typed %s → %s', (ai, typed, status) => {
    const before = row({ aiPlannedQty: ai, plannedQty: 3, reviewStatus: 'edited' })
    expect(apply(before, { plannedQty: typed }).reviewStatus).toBe(status)
  })
})

describe('applyReviewRules — a picked Status sets the Przedmiar', () => {
  it('Zaakceptowana copies AI przedmiar', () => {
    expect(apply(row({ plannedQty: 3 }), { reviewStatus: 'accepted' }).plannedQty).toBe(10)
  })

  it('Odrzucona sets 0', () => {
    expect(apply(row({ plannedQty: 3 }), { reviewStatus: 'rejected' }).plannedQty).toBe(0)
  })

  it('Edytowana keeps the Przedmiar', () => {
    expect(apply(row({ plannedQty: 3 }), { reviewStatus: 'edited' }).plannedQty).toBe(3)
  })

  it.each([null, 0])('leaves the typed Przedmiar of a row with AI %s alone', (ai) => {
    const before = row({ aiPlannedQty: ai, plannedQty: 3 })
    expect(apply(before, { reviewStatus: 'accepted' }).plannedQty).toBe(3)
    expect(apply(before, { reviewStatus: 'rejected' }).plannedQty).toBe(3)
  })
})

describe('applyReviewRules — scope', () => {
  it('is a no-op without an AI draft', () => {
    const before = row({ plannedQty: 3 })
    const next = [{ ...before, plannedQty: 10 }]
    expect(applyReviewRules(next, new Map([[1, before]]), false)).toBe(next)
  })

  it('returns the same array when nothing derives', () => {
    const before = row({ plannedQty: 3 })
    const next = [before]
    expect(applyReviewRules(next, new Map([[1, before]]), true)).toBe(next)
  })

  it('skips a row with no snapshot', () => {
    const next = [row({ id: 9, plannedQty: 10 })]
    expect(applyReviewRules(next, new Map(), true)).toBe(next)
  })
})

describe('effectiveReviewStatus', () => {
  it('reads a stored status as it is', () => {
    expect(effectiveReviewStatus(row({ reviewStatus: 'edited' }))).toBe('edited')
  })

  it('reads a praca the agent never saw, with a Przedmiar, as Dodana', () => {
    expect(effectiveReviewStatus(row({ aiPlannedQty: null, plannedQty: 2 }))).toBe('added')
  })

  it('stays empty with no Przedmiar, or a row the agent priced', () => {
    expect(effectiveReviewStatus(row({ aiPlannedQty: null, plannedQty: 0 }))).toBeNull()
    expect(effectiveReviewStatus(row({ aiPlannedQty: 0, plannedQty: 2 }))).toBeNull()
  })
})

describe('hasAiDraft', () => {
  it('is true once any row carries AI przedmiar, 0 included', () => {
    expect(hasAiDraft([{ aiPlannedQty: null }, { aiPlannedQty: 0 }])).toBe(true)
    expect(hasAiDraft([{ aiPlannedQty: null }])).toBe(false)
    expect(hasAiDraft([])).toBe(false)
  })
})
