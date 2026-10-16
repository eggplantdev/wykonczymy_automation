import { describe, expect, it } from 'vitest'
import { reportScopeRefusal, resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const stage = (
  id: number,
  plane: KosztorysStageT['plane'],
  workerId: number | null,
  completed = false,
) =>
  makeStage({
    id,
    ordinal: id,
    plane,
    split: workerId == null ? null : oneWorkerSplit(workerId),
    completed,
  })

describe('resolveWorkerScope', () => {
  it('is ready on the one plane of a worker holding two etapy of it, and keeps only his etapy', () => {
    const stages = [stage(1, 'own_tools', 5), stage(2, 'w_tools', 9), stage(3, 'own_tools', 5)]
    expect(resolveWorkerScope(stages, 5)).toEqual({
      kind: 'ready',
      plane: 'own_tools',
      stages: [stages[0], stages[2]],
    })
  })

  it('blocks a worker with no etapy', () => {
    expect(resolveWorkerScope([stage(1, 'w_tools', 9)], 5)).toEqual({
      kind: 'blocked',
      reason: 'no-stages',
    })
  })

  it('blocks a worker holding an etap with no rozliczenie', () => {
    expect(resolveWorkerScope([stage(1, 'w_tools', 5), stage(2, null, 5)], 5)).toEqual({
      kind: 'blocked',
      reason: 'unconfirmed-plane',
    })
  })

  it('blocks a worker whose etapy span both rozliczenia', () => {
    expect(resolveWorkerScope([stage(1, 'w_tools', 5), stage(2, 'own_tools', 5)], 5)).toEqual({
      kind: 'blocked',
      reason: 'mixed-planes',
    })
  })

  it("ignores another worker's etapy entirely", () => {
    expect(resolveWorkerScope([stage(1, 'w_tools', 5), stage(2, null, 9)], 5).kind).toBe('ready')
  })
})

describe('reportScopeRefusal (EX-1034)', () => {
  const refusalFor = (stages: KosztorysStageT[]) =>
    reportScopeRefusal(resolveWorkerScope(stages, 5))

  it('lets him report while one of his etapy is still open', () => {
    expect(refusalFor([stage(1, 'w_tools', 5, true), stage(2, 'w_tools', 5)])).toBeNull()
  })

  it('refuses once all his etapy are zakończone', () => {
    expect(refusalFor([stage(1, 'w_tools', 5, true), stage(2, 'w_tools', 5, true)])).toBe(
      'stages-completed',
    )
  })

  it('ignores someone else’s open etap on the same investment', () => {
    expect(refusalFor([stage(1, 'w_tools', 5, true), stage(2, 'w_tools', 9)])).toBe(
      'stages-completed',
    )
  })

  it('names the blocked scope first, before asking about zakończone etapy', () => {
    expect(refusalFor([stage(1, 'w_tools', 5, true), stage(2, null, 5, true)])).toBe(
      'unconfirmed-plane',
    )
  })
})
