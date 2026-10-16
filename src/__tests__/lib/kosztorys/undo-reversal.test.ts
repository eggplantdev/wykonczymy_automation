import { describe, expect, it } from 'vitest'

import { buildReversalPatches, planReversalWrites } from '@/lib/kosztorys/undo-reversal'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'

const FIELDS: FieldChangeT[] = [
  { id: 1, field: 'description', before: 'Malowanie', after: 'Gruntowanie' },
  { id: 1, field: 'clientPrice', before: 100, after: 120 },
  { id: 2, field: 'unit', before: 'm2', after: 'mb' },
]
const STAGES: StageChangeT[] = [{ id: 1, stageId: 100, before: 0, after: 3 }]

describe('buildReversalPatches', () => {
  it('merges every change of one row into a single patch', () => {
    const patches = buildReversalPatches(FIELDS, STAGES, 'undo')

    expect(patches.get(1)).toEqual({ description: 'Malowanie', clientPrice: 100, stage_100: 0 })
    expect(patches.get(2)).toEqual({ unit: 'm2' })
  })

  it('takes the after values under redo', () => {
    const patches = buildReversalPatches(FIELDS, STAGES, 'redo')

    expect(patches.get(1)).toEqual({ description: 'Gruntowanie', clientPrice: 120, stage_100: 3 })
  })
})

describe('planReversalWrites', () => {
  // The lane keys must match the ones the forward autosave used for the same cell, or an undo can
  // overtake the save it is undoing (EX-526 #1).
  it('pairs each write with its cell lane', () => {
    const writes = planReversalWrites(FIELDS, STAGES, 'undo')

    expect(writes.map((w) => w.lane)).toEqual([
      'item:1:description',
      'item:1:clientPrice',
      'item:2:unit',
      'progress:1:100',
    ])
  })

  it('sends the before value and restores the after under undo', () => {
    const [first] = planReversalWrites(FIELDS, STAGES, 'undo')

    expect(first).toMatchObject({ kind: 'field', value: 'Malowanie', restore: 'Gruntowanie' })
  })

  it('mirrors both under redo', () => {
    const [first] = planReversalWrites(FIELDS, STAGES, 'redo')

    expect(first).toMatchObject({ kind: 'field', value: 'Gruntowanie', restore: 'Malowanie' })
  })

  it('tags a stage write with its item and stage rather than a field', () => {
    const stageWrite = planReversalWrites([], STAGES, 'undo')[0]

    expect(stageWrite).toEqual({
      kind: 'stage',
      lane: 'progress:1:100',
      id: 1,
      stageId: 100,
      value: 0,
      restore: 3,
    })
  })
})
