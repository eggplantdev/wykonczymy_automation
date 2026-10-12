import { describe, it, expect } from 'vitest'
import { aiProgressOf } from '@/lib/constants/investment-ai-stage'

describe('aiProgressOf', () => {
  it.each([
    [null, false, 'none'],
    [null, true, 'analyzed'],
    ['ready_for_analysis', false, 'ready_for_analysis'],
    ['ready_for_analysis', true, 'analyzed'],
    ['analyzed', false, 'analyzed'],
    ['analyzed', true, 'analyzed'],
    ['review_done', false, 'review_done'],
    ['review_done', true, 'review_done'],
    ['knowledge_extracted', false, 'knowledge_extracted'],
    ['knowledge_extracted', true, 'knowledge_extracted'],
  ] as const)('stage %s, draft %s → %s', (stage, hasAiDraft, step) => {
    expect(aiProgressOf(stage, hasAiDraft)).toBe(step)
  })
})
