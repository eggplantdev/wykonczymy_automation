import { describe, expect, it } from 'vitest'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  type FieldChangeT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'

// react-datasheet-grid text cells use continuousUpdates:true → one onChange per keystroke. These
// reducers collapse the burst into a single undo entry (before = first seen, after = last), and
// drop a burst whose net effect is zero (type-then-revert) so it never pollutes the undo stack.

const field = (over: Partial<FieldChangeT>): FieldChangeT => ({
  id: 1,
  field: 'description',
  before: 'Malowanie',
  after: 'Malowanie',
  ...over,
})

const stage = (over: Partial<StageChangeT>): StageChangeT => ({
  id: 1,
  stageId: 100,
  before: 0,
  after: 0,
  ...over,
})

describe('coalesceFieldChanges', () => {
  it('collapses a per-keystroke burst on one cell into one entry (before=first, after=last)', () => {
    const burst = [
      field({ before: 'Mal', after: 'Malo' }),
      field({ before: 'Malo', after: 'Malow' }),
      field({ before: 'Malow', after: 'Malowanie' }),
    ]
    expect(coalesceFieldChanges(burst)).toEqual([
      { id: 1, field: 'description', before: 'Mal', after: 'Malowanie' },
    ])
  })

  it('drops a net-zero burst (type then revert to the original)', () => {
    const burst = [
      field({ before: 'Malowanie', after: 'Malowaniey' }),
      field({ before: 'Malowaniey', after: 'Malowanie' }),
    ]
    expect(coalesceFieldChanges(burst)).toEqual([])
  })

  it('keeps one net entry per distinct (row, field)', () => {
    const seq = [
      field({ id: 1, field: 'description', before: 'a', after: 'ab' }),
      field({ id: 2, field: 'unit', before: 'm2', after: 'mb' }),
      field({ id: 1, field: 'description', before: 'ab', after: 'abc' }),
    ]
    expect(coalesceFieldChanges(seq)).toEqual([
      { id: 1, field: 'description', before: 'a', after: 'abc' },
      { id: 2, field: 'unit', before: 'm2', after: 'mb' },
    ])
  })

  it('drops the reverted cell but keeps the genuinely changed one', () => {
    const seq = [
      field({ id: 1, field: 'description', before: 'a', after: 'ax' }),
      field({ id: 2, field: 'unit', before: 'm2', after: 'm2x' }),
      field({ id: 1, field: 'description', before: 'ax', after: 'a' }), // reverted
    ]
    expect(coalesceFieldChanges(seq)).toEqual([
      { id: 2, field: 'unit', before: 'm2', after: 'm2x' },
    ])
  })

  it('does not mutate the input entries', () => {
    const first = field({ before: 'a', after: 'ab' })
    const second = field({ before: 'ab', after: 'abc' })
    coalesceFieldChanges([first, second])
    expect(first.after).toBe('ab')
  })
})

describe('coalesceStageChanges', () => {
  it('collapses a burst on one item×stage into one entry', () => {
    const burst = [
      stage({ before: 0, after: 1 }),
      stage({ before: 1, after: 2 }),
      stage({ before: 2, after: 3 }),
    ]
    expect(coalesceStageChanges(burst)).toEqual([{ id: 1, stageId: 100, before: 0, after: 3 }])
  })

  it('drops a net-zero stage burst', () => {
    const burst = [stage({ before: 0, after: 5 }), stage({ before: 5, after: 0 })]
    expect(coalesceStageChanges(burst)).toEqual([])
  })
})
