import { describe, expect, it } from 'vitest'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  foldRetractions,
  undoAvailability,
  type FieldChangeT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'

// react-datasheet-grid text cells use continuousUpdates:true → one onChange per keystroke.

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

// the keyboard shortcut already flushes-then-undoes, so the button must not sit
// greyed out while Cmd+Z works.
describe('undoAvailability', () => {
  it('reports a buffering burst as undoable even on an empty stack', () => {
    expect(undoAvailability(false, false, true)).toEqual({ canUndo: true, canRedo: false })
  })

  it('withdraws redo while a burst buffers, because flushing it will clear the redo path', () => {
    expect(undoAvailability(true, true, true)).toEqual({ canUndo: true, canRedo: false })
  })

  it('passes the stack through once nothing is buffering', () => {
    expect(undoAvailability(true, true, false)).toEqual({ canUndo: true, canRedo: true })
    expect(undoAvailability(false, false, false)).toEqual({ canUndo: false, canRedo: false })
  })
})

describe('foldRetractions', () => {
  it('cancels a pushed prefix against the rollback that took it back', () => {
    const previous = {
      fields: [field({ field: 'wToolsOverrideValue', before: 100, after: 234 })],
      stages: [],
    }
    const next = {
      fields: [field({ field: 'wToolsOverrideValue', before: 234, after: 100 })],
      stages: [],
    }

    const folded = foldRetractions(previous, next)

    expect(folded.retracted).toBe(true)
    expect(folded.previous.fields).toEqual([])
    expect(folded.next.fields).toEqual([])
  })

  it('leaves a burst that CONTINUES the previous command alone', () => {
    const previous = { fields: [field({ before: 'Mal', after: 'Malow' })], stages: [] }
    const next = { fields: [field({ before: 'Malow', after: 'Malowanie' })], stages: [] }

    const folded = foldRetractions(previous, next)

    expect(folded.retracted).toBe(false)
    expect(folded.previous.fields).toEqual(previous.fields)
    expect(folded.next.fields).toEqual(next.fields)
  })

  it('only cancels the retracted cell, keeping every other change on both sides', () => {
    const previous = {
      fields: [
        field({ id: 1, field: 'wToolsOverrideValue', before: 100, after: 234 }),
        field({ id: 2, field: 'description', before: 'a', after: 'ab' }),
      ],
      stages: [],
    }
    const next = {
      fields: [
        field({ id: 1, field: 'wToolsOverrideValue', before: 234, after: 100 }),
        field({ id: 3, field: 'unit', before: 'm2', after: 'mb' }),
      ],
      stages: [],
    }

    const folded = foldRetractions(previous, next)

    expect(folded.previous.fields).toEqual([
      { id: 2, field: 'description', before: 'a', after: 'ab' },
    ])
    expect(folded.next.fields).toEqual([{ id: 3, field: 'unit', before: 'm2', after: 'mb' }])
  })

  it('does not cancel across cells — same values, different (row, field)', () => {
    const previous = { fields: [field({ id: 1, before: 'a', after: 'b' })], stages: [] }
    const next = { fields: [field({ id: 2, before: 'b', after: 'a' })], stages: [] }

    expect(foldRetractions(previous, next).retracted).toBe(false)
  })

  it('cancels a stage quantity the same way', () => {
    const previous = { fields: [], stages: [stage({ before: 3, after: 12 })] }
    const next = { fields: [], stages: [stage({ before: 12, after: 3 })] }

    const folded = foldRetractions(previous, next)

    expect(folded.retracted).toBe(true)
    expect(folded.previous.stages).toEqual([])
    expect(folded.next.stages).toEqual([])
  })

  it('leaves both sides untouched when the previous command is a different kind of edit', () => {
    const previous = { fields: [], stages: [stage({ before: 0, after: 5 })] }
    const next = { fields: [field({ before: 'a', after: 'b' })], stages: [] }

    const folded = foldRetractions(previous, next)

    expect(folded.retracted).toBe(false)
    expect(folded.previous.stages).toEqual(previous.stages)
    expect(folded.next.fields).toEqual(next.fields)
  })
})
