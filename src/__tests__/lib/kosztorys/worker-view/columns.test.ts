import { describe, expect, it } from 'vitest'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 7, label: 'Etap 1', split: oneWorkerSplit(3) }),
  makeStage({ id: 9, ordinal: 2, label: 'Etap 2', split: oneWorkerSplit(3) }),
]

const stageRow = (overrides: Parameters<typeof row>[0] = {}) =>
  row({ [stageKey(7)]: 0, [stageKey(9)]: 0, ...overrides })

const PLANNED = ['currentPlannedQty', 'plannedNetForPlane']

describe('workerDataHiddenColumns', () => {
  it.each([true, false])(
    'before any entry: every settlement column and etap off, the przedmiar kept (checkbox %s)',
    (hidePlannedOnceExecuted) => {
      const hidden = workerDataHiddenColumns([stageRow()], STAGES, hidePlannedOnceExecuted)

      for (const id of [
        'stageQtySum',
        'net',
        'plannedDonePercent',
        stageKey(7),
        stageValueNetKey(9),
      ]) {
        expect(hidden.has(id), id).toBe(true)
      }
      for (const id of PLANNED) expect(hidden.has(id), id).toBe(false)
    },
  )

  it('with an entry and the checkbox on: przedmiar off, the filled etap on, the empty one off', () => {
    const hidden = workerDataHiddenColumns([stageRow({ [stageKey(7)]: 2 })], STAGES, true)

    for (const id of PLANNED) expect(hidden.has(id), id).toBe(true)
    expect(hidden.has('plannedQty')).toBe(false)
    for (const id of [
      'stageQtySum',
      'net',
      'plannedDonePercent',
      stageKey(7),
      stageValueNetKey(7),
    ]) {
      expect(hidden.has(id), id).toBe(false)
    }
    expect(hidden.has(stageKey(9))).toBe(true)
    expect(hidden.has(stageValueNetKey(9))).toBe(true)
  })

  it('with an entry and the checkbox off: the przedmiar stays', () => {
    const hidden = workerDataHiddenColumns([stageRow({ [stageKey(7)]: 2 })], STAGES, false)

    for (const id of PLANNED) expect(hidden.has(id), id).toBe(false)
  })

  it('never takes „Pozostało" off', () => {
    for (const rows of [[stageRow()], [stageRow({ [stageKey(9)]: 1 })]]) {
      expect(workerDataHiddenColumns(rows, STAGES, true).has('remainingForPlane')).toBe(false)
    }
  })
})
