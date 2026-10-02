import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { subcontractorStageBreakdown } from '@/lib/kosztorys/subcontractor-stage-breakdown'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

const ANNA = 1
const BARTEK = 2
const CELINA = 3
const WORKERS = [
  { workerId: ANNA, name: 'Anna' },
  { workerId: BARTEK, name: 'Bartek' },
  { workerId: CELINA, name: 'Celina' },
  { workerId: null, name: 'Bez przypisanego pracownika' },
]

// One pozycja at stawka 10 z narzędziami: etap 100 holds 4 (40 zł), 101 holds 2 (20 zł), 102 nothing.
const stages: KosztorysStageT[] = [
  {
    id: 100,
    ordinal: 1,
    label: 'Tynki',
    plane: 'w_tools',
    split: {
      mode: 'percent',
      members: [
        { workerId: ANNA, value: 60, takesRest: false },
        { workerId: CELINA, value: 0, takesRest: true },
      ],
    },
  },
  { id: 101, ordinal: 2, label: null, plane: 'w_tools', split: null },
  { id: 102, ordinal: 3, label: null, plane: 'w_tools', split: oneWorkerSplit(BARTEK) },
]
const tree = makeTree({
  sections: [
    {
      id: 10,
      name: 'Łazienka',
      displayOrder: 0,
      color: null,
      items: [
        {
          ...baseItem,
          id: 1,
          description: 'Tynk',
          plannedQty: 6,
          clientPrice: 30,
          wToolsOverrideValue: 10,
        },
      ],
    },
  ],
  stages,
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 4 },
    { itemId: 1, stageId: 101, qtyDone: 2 },
  ],
})

describe('subcontractorStageBreakdown', () => {
  const due = subcontractorDueByPlane(treeToRows(tree), stages)
  const breakdown = subcontractorStageBreakdown(due, stages, WORKERS)

  it('divides each etap between the people who take it, the rest to nobody', () => {
    expect(breakdown.workers.map((worker) => worker.name)).toEqual([
      'Anna',
      'Celina',
      'Bez przypisanego pracownika',
    ])
    expect(breakdown.rows).toEqual([
      { stageId: 100, label: 'Tynki', wholeNet: 40, shares: [24, 16, null] },
      { stageId: 101, label: 'Etap 2', wholeNet: 20, shares: [null, null, 20] },
    ])
  })

  it('totals every column to the figure „Podsumowanie pracowników" shows for that person', () => {
    expect(breakdown.totals.wholeNet).toBe(due.combined)
    breakdown.workers.forEach((worker, column) => {
      expect(breakdown.totals.shares[column]).toBe(due.byWorker.get(worker.workerId))
    })
  })
})
