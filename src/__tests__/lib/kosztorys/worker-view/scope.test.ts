import { describe, expect, it } from 'vitest'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-worker-split'

const stage = (id: number, plane: KosztorysStageT['plane'], workerId: number | null) => ({
  id,
  ordinal: id,
  label: null,
  plane,
  split: workerId == null ? null : oneWorkerSplit(workerId),
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

  // A plane-less etap has no stawka to show, so there is no price the view could honestly print.
  it('blocks a worker holding an etap with no rozliczenie', () => {
    expect(resolveWorkerScope([stage(1, 'w_tools', 5), stage(2, null, 5)], 5)).toEqual({
      kind: 'blocked',
      reason: 'unconfirmed-plane',
    })
  })

  // One „Cena j.m." per pozycja must mean one stawka.
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
