import { describe, expect, it } from 'vitest'
import { ROW_CONDITIONS } from '@/lib/kosztorys/row-conditions/registry'
import {
  STAGE_CONDITIONS,
  countMatchingStages,
  stagesMatchingEngaged,
} from '@/lib/kosztorys/stage-conditions'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

function stage(overrides: Partial<KosztorysStageT> = {}): KosztorysStageT {
  return { id: 1, ordinal: 1, label: null, plane: 'w_tools', workerId: 5, ...overrides }
}

const BARE = stage({ id: 1, plane: null, workerId: null })
const NO_WORKER = stage({ id: 2, plane: 'own_tools', workerId: null })
const FINE = stage({ id: 3 })

describe('the stage conditions, each on its boundary', () => {
  it('„bez wybranego sposobu rozliczenia" reads only the missing plane', () => {
    expect(countMatchingStages([BARE, NO_WORKER, FINE], 'stage-no-plane')).toBe(1)
  })

  it('„bez przypisanego wykonawcy" catches a plane-less etap too — the deliberate double count', () => {
    expect(countMatchingStages([BARE, NO_WORKER, FINE], 'stage-no-worker')).toBe(2)
  })

  it('reads an unknown id as zero', () => {
    expect(countMatchingStages([BARE], 'no-such-condition')).toBe(0)
  })

  // One engaged-ids set drives both registries, so a collision would silently make one condition
  // answer for the other.
  it('shares a flat id namespace with the row registry without colliding', () => {
    const rowIds = new Set(ROW_CONDITIONS.map((condition) => condition.id))
    for (const condition of STAGE_CONDITIONS) expect(rowIds.has(condition.id)).toBe(false)
  })
})

describe('stagesMatchingEngaged', () => {
  const stages = [BARE, NO_WORKER, FINE]
  const ids = (subject: KosztorysStageT[]) => subject.map((st) => st.id)

  it('is a no-op with nothing engaged — and hands back the same array, not a copy', () => {
    expect(stagesMatchingEngaged(stages, [])).toBe(stages)
  })

  it('keeps only what one engaged condition matches', () => {
    expect(ids(stagesMatchingEngaged(stages, ['stage-no-plane']))).toEqual([1])
  })

  // Under AND the two would ask for an etap that is both at once, emptying the stage block while both
  // counts promised something to fix.
  it('unions two engaged conditions rather than intersecting them', () => {
    expect(ids(stagesMatchingEngaged(stages, ['stage-no-plane', 'stage-no-worker']))).toEqual([
      1, 2,
    ])
  })

  it('ignores an id nobody knows rather than matching nothing', () => {
    expect(stagesMatchingEngaged(stages, ['no-such-condition'])).toBe(stages)
    expect(ids(stagesMatchingEngaged(stages, ['no-such-condition', 'stage-no-plane']))).toEqual([1])
  })
})
