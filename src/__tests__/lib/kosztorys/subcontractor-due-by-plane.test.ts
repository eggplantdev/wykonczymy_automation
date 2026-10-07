import { describe, expect, it } from 'vitest'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement-aggregates'
import { sumSectionSubtotalsNet } from '@/lib/kosztorys/settlement-client-totals'
import { hasStagesOverPlanned, rowTotalQtyDone } from '@/lib/kosztorys/settlement-rows'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { KosztorysStageT, KosztorysTreeT, StageSplitT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// Row 1 executes 2 (stage 100) + 3 (stage 101) of planned 5, client price 20.
// Row 2 executes 4 (stage 100) of planned 4, client price 10, with a flat 'amount' rabat of 8.
// Subcontractor prices are flat overrides: z narzędziami = 12, bez narzędzi = 10.
const makePlaneTree = (
  stages: KosztorysStageT[],
  extra?: Partial<KosztorysTreeT>,
): KosztorysTreeT =>
  makeTree({
    sections: [
      {
        id: 10,
        name: 'Sekcja A',
        displayOrder: 0,
        color: null,
        items: [
          { ...baseItem, id: 1, description: 'A', plannedQty: 5, clientPrice: 20 },
          {
            ...baseItem,
            id: 2,
            description: 'B',
            plannedQty: 4,
            clientPrice: 10,
            discountType: 'amount' as const,
            discountValue: 8,
          },
        ],
      },
    ],
    stages,
    progress: [
      { itemId: 1, stageId: 100, qtyDone: 2 },
      { itemId: 1, stageId: 101, qtyDone: 3 },
      { itemId: 2, stageId: 100, qtyDone: 4 },
    ],
    vatRate: 0.08,
    ...extra,
  })

const allWTools: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
  { id: 101, ordinal: 2, label: null, plane: 'w_tools', split: null },
]
const mixed: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
  { id: 101, ordinal: 2, label: null, plane: 'own_tools', split: null },
]
const allNull: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: null, plane: null, split: null },
  { id: 101, ordinal: 2, label: null, plane: null, split: null },
]

describe('subcontractorDueByPlane', () => {
  it('single-plane investment matches sumSectionSubtotalsNet at that view', () => {
    const tree = makePlaneTree(allWTools)
    const rows = treeToRows(tree)
    const due = subcontractorDueByPlane(rows, tree.stages)
    const parity = sumSectionSubtotalsNet(sectionSubtotalsForView(rows, tree.stages, 'w_tools'))
    // Row 1: 5 qty @ 12 = 60; row 2: 4 qty @ 12 = 48 → 108, all z narzędziami.
    expect(due.wTools).toBeCloseTo(108)
    expect(due.ownTools).toBeCloseTo(0)
    expect(due.combined).toBeCloseTo(parity)
    expect(due.hasUnconfirmedPlane).toBe(false)
  })

  it('mixed planes sum each side at its own price', () => {
    const tree = makePlaneTree(mixed)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 100 (z narzędziami @ 12): row1 2·12 + row2 4·12 = 72.
    // Stage 101 (bez narzędzi @ 10): row1 3·10 = 30.
    expect(due.wTools).toBeCloseTo(72)
    expect(due.ownTools).toBeCloseTo(30)
    expect(due.combined).toBeCloseTo(102)
    expect(due.hasUnconfirmedPlane).toBe(false)
  })

  // Undecided is not a plane: charging it to a crew nobody picked would be a fabricated debt. The
  // amount goes missing on purpose and the flag is the only thing that reports it.
  it('null plane belongs to neither crew and raises the unconfirmed flag', () => {
    const tree = makePlaneTree(allNull)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.wTools).toBe(0)
    expect(due.ownTools).toBe(0)
    expect(due.combined).toBe(0)
    expect(due.hasUnconfirmedPlane).toBe(true)
  })

  it('flags unconfirmed when any single stage is null', () => {
    const tree = makePlaneTree([
      { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
      { id: 101, ordinal: 2, label: null, plane: null, split: null },
    ])
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.hasUnconfirmedPlane).toBe(true)
  })

  it('is unchanged by per-item rabat (pre-rabat: rabat never reaches subcontractors)', () => {
    // Item 2 carries a flat-8 rabat; the combined figure ignores it.
    const tree = makePlaneTree(mixed)
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.combined).toBeCloseTo(102)
  })

  it('is unchanged by an active global discount', () => {
    const plain = makePlaneTree(mixed)
    const discounted = makePlaneTree(mixed, { globalDiscount: { type: 'amount', value: 10 } })
    const a = subcontractorDueByPlane(treeToRows(plain), plain.stages)
    const b = subcontractorDueByPlane(treeToRows(discounted), discounted.stages)
    expect(b.combined).toBeCloseTo(a.combined)
    expect(b.wTools).toBeCloseTo(a.wTools)
    expect(b.ownTools).toBeCloseTo(a.ownTools)
  })

  it('respects per-row price overrides per plane', () => {
    // Row 1 gets a flat override on the own_tools plane; the bez-narzędzi bucket must use it.
    const tree = makePlaneTree(mixed)
    tree.sections[0].items[0].ownToolsOverrideValue = 10
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 101 (own_tools) still only holds row1's 3 qty → 3 · 10 = 30.
    expect(due.ownTools).toBeCloseTo(30)
  })

  it('no stages → zeros and no warning', () => {
    const tree = makePlaneTree([])
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due).toEqual({
      wTools: 0,
      ownTools: 0,
      combined: 0,
      hasUnconfirmedPlane: false,
      byStage: new Map(),
      byWorker: new Map(),
      byStageWorker: new Map(),
      scaledDownStageIds: new Set(),
      unconfirmedWorkers: new Set(),
    })
  })
})

// EX-613: the same executed money, partitioned by who is to do it. The load-bearing property is the
// partition — every złoty lands in exactly one bucket, and the unassigned residual is a bucket, not a
// rounding difference sprinkled over the named workers.
describe('subcontractorDueByPlane — byWorker', () => {
  const assigned = (stages: KosztorysStageT[], workerIds: (number | null)[]): KosztorysStageT[] =>
    stages.map((stage, index) => {
      const workerId = workerIds[index]
      return { ...stage, split: workerId == null ? null : oneWorkerSplit(workerId) }
    })

  const sumOf = (byWorker: Map<number | null, number>) =>
    [...byWorker.values()].reduce((sum, value) => sum + value, 0)

  it('partitions combined across workers, unassigned included', () => {
    const tree = makePlaneTree(assigned(mixed, [7, null]))
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 100 (worker 7, z narzędziami) = 72; stage 101 (nobody, bez narzędzi) = 30.
    expect(due.byWorker.get(7)).toBeCloseTo(72)
    expect(due.byWorker.get(null)).toBeCloseTo(30)
    expect(sumOf(due.byWorker)).toBeCloseTo(due.combined)
  })

  it('accumulates a worker holding etapy on BOTH planes into one figure', () => {
    const tree = makePlaneTree(assigned(mixed, [7, 7]))
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.byWorker.get(7)).toBeCloseTo(102)
    // The whole point of the map: this figure is not reachable from the plane split.
    expect(due.byWorker.get(7)).not.toBeCloseTo(due.wTools)
    expect(sumOf(due.byWorker)).toBeCloseTo(due.combined)
  })

  // Same invariance the combined figure has — a worker's należne is what they executed, not what the
  // client was charged, so neither discount mode may move it.
  it('a worker´s należne is unmoved by per-item rabat or a global discount', () => {
    const plain = makePlaneTree(assigned(mixed, [7, 8]))
    const discounted = makePlaneTree(assigned(mixed, [7, 8]), {
      globalDiscount: { type: 'amount', value: 10 },
    })
    const a = subcontractorDueByPlane(treeToRows(plain), plain.stages)
    const b = subcontractorDueByPlane(treeToRows(discounted), discounted.stages)
    // Row 2 carries the flat-8 per-item rabat and lands entirely in stage 100 → worker 7.
    expect(a.byWorker.get(7)).toBeCloseTo(72)
    expect(b.byWorker.get(7)).toBeCloseTo(a.byWorker.get(7)!)
    expect(b.byWorker.get(8)).toBeCloseTo(a.byWorker.get(8)!)
  })

  // A plane-less etap is skipped before any value is computed, so its worker earns nothing from it —
  // they are assigned but owed 0, which is what the panel's `no_executed_work` state exists to say.
  it('credits nobody for a plane-less etap, even when it is assigned', () => {
    const tree = makePlaneTree(
      assigned(
        [
          { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
          { id: 101, ordinal: 2, label: null, plane: null, split: null },
        ],
        [7, 8],
      ),
    )
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.byWorker.has(8)).toBe(false)
    expect(sumOf(due.byWorker)).toBeCloseTo(due.combined)
  })
})

// EX-943: an etap's pool is split among its workers by the one arithmetic in `splitStagePool`.
describe('subcontractorDueByPlane — shared etapy', () => {
  const withSplits = (splits: (StageSplitT | null)[]): KosztorysStageT[] =>
    mixed.map((stage, index) => ({ ...stage, split: splits[index] }))

  const sumOf = (byWorker: Map<number | null, number>) =>
    [...byWorker.values()].reduce((sum, value) => sum + value, 0)

  it('splits one etap by percent and keeps Σ byWorker equal to combined', () => {
    const split: StageSplitT = {
      mode: 'percent',
      members: [
        { workerId: 7, value: 25, takesRest: false },
        { workerId: 8, value: 0, takesRest: true },
      ],
    }
    const tree = makePlaneTree(withSplits([split, oneWorkerSplit(8)]))
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    // Stage 100 = 72 → 18 / 54; stage 101 = 30 → all worker 8.
    expect(due.byWorker.get(7)).toBeCloseTo(18)
    expect(due.byWorker.get(8)).toBeCloseTo(84)
    expect(due.byStageWorker.get(100)?.get(8)).toBeCloseTo(54)
    expect(sumOf(due.byWorker)).toBeCloseTo(due.combined)
    expect(due.scaledDownStageIds.size).toBe(0)
  })

  it('shrinks fixed amounts above the pool and marks the etap', () => {
    const split: StageSplitT = {
      mode: 'amount',
      members: [
        { workerId: 7, value: 60, takesRest: false },
        { workerId: 9, value: 60, takesRest: false },
        { workerId: 8, value: 0, takesRest: true },
      ],
    }
    const tree = makePlaneTree(withSplits([split, null]))
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.byWorker.get(7)).toBeCloseTo(36)
    expect(due.byWorker.get(9)).toBeCloseTo(36)
    expect(due.byWorker.get(8)).toBe(0)
    expect(due.scaledDownStageIds.has(100)).toBe(true)
    expect(sumOf(due.byWorker)).toBeCloseTo(due.combined)
  })

  it('flags every member of a plane-less etap that holds work', () => {
    const split: StageSplitT = {
      mode: 'percent',
      members: [
        { workerId: 7, value: 50, takesRest: false },
        { workerId: 8, value: 0, takesRest: true },
      ],
    }
    const tree = makePlaneTree([{ id: 100, ordinal: 1, label: null, plane: null, split }])
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect([...due.unconfirmedWorkers]).toEqual([7, 8])
    expect(due.byWorker.size).toBe(0)
  })

  // 32593.76 × (33.33% + 12.5% + rest) re-sums to pool + 3.6e-12 — enough to surface an empty
  // „Nieprzypisane" row in the summary when the residue is read as unassigned money.
  it('credits nobody unassigned on the float residue of a full split', () => {
    const split: StageSplitT = {
      mode: 'percent',
      members: [
        { workerId: 7, value: 33.33, takesRest: false },
        { workerId: 9, value: 12.5, takesRest: false },
        { workerId: 8, value: 0, takesRest: true },
      ],
    }
    const tree = makeTree({
      sections: [
        {
          id: 10,
          name: 'Sekcja A',
          displayOrder: 0,
          color: null,
          items: [
            {
              ...baseItem,
              id: 1,
              description: 'A',
              plannedQty: 1,
              clientPrice: 0,
              wToolsOverrideValue: 32593.76,
            },
          ],
        },
      ],
      stages: [{ id: 100, ordinal: 1, label: null, plane: 'w_tools', split }],
      progress: [{ itemId: 1, stageId: 100, qtyDone: 1 }],
    })
    const due = subcontractorDueByPlane(treeToRows(tree), tree.stages)
    expect(due.byStage.get(100)).toBe(32593.76)
    expect(due.byWorker.has(null)).toBe(false)
  })
})

// „Pomiar z natury" is the sheet's O = SUM(D:M) (EX-494), so scoping it to the view is what makes a
// subcontractor view one crew's bill instead of the whole rozpiska repriced. These pin the two rules
// the scoping establishes; everything above the quantity (wartość, podsumy, „Razem") follows for free.
describe('pomiar liczony po planie etapu', () => {
  it('każdy widok podwykonawcy widzi tylko swoje etapy, klient widzi całe O', () => {
    const tree = makePlaneTree(mixed)
    const [row1] = treeToRows(tree) // stage 100 = 2 (z narzędziami), stage 101 = 3 (bez narzędzi)
    expect(rowTotalQtyDone(row1, tree.stages, 'w_tools')).toBe(2)
    expect(rowTotalQtyDone(row1, tree.stages, 'own_tools')).toBe(3)
    expect(rowTotalQtyDone(row1, tree.stages, 'client')).toBe(5)
  })

  it('etap bez wybranego trybu nie należy do żadnego widoku podwykonawcy', () => {
    const tree = makePlaneTree(allNull)
    const [row1] = treeToRows(tree)
    expect(rowTotalQtyDone(row1, tree.stages, 'w_tools')).toBe(0)
    expect(rowTotalQtyDone(row1, tree.stages, 'own_tools')).toBe(0)
    expect(rowTotalQtyDone(row1, tree.stages, 'client')).toBe(5)
  })

  // The consistency test the owner reads off the screen: the two bills add up to the executed work,
  // and each equals its own row in „Podsumowanie podwykonawców". Rabat is client-only in pricing, so
  // there is no pre/post-rabat gap between the grid's „Razem netto" and the panel's figure.
  it('Razem(z) + Razem(bez) = wykonana praca, i każde zgadza się z panelem', () => {
    const tree = makePlaneTree(mixed)
    const rows = treeToRows(tree)
    const razem = (view: 'w_tools' | 'own_tools') =>
      sumSectionSubtotalsNet(sectionSubtotalsForView(rows, tree.stages, view))
    const due = subcontractorDueByPlane(rows, tree.stages)

    expect(razem('w_tools')).toBeCloseTo(due.wTools)
    expect(razem('own_tools')).toBeCloseTo(due.ownTools)
    expect(razem('w_tools') + razem('own_tools')).toBeCloseTo(due.combined)
  })

  // The accepted cost of rule 2: while any etap is unassigned the identity above breaks, and the flag
  // is the only thing that says so. Pinned so nobody "fixes" the shortfall by defaulting a plane.
  it('nieprzypisany etap wypada z obu rachunków — suma jest krótsza, flaga podniesiona', () => {
    const tree = makePlaneTree([
      { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
      { id: 101, ordinal: 2, label: null, plane: null, split: null },
    ])
    const rows = treeToRows(tree)
    const due = subcontractorDueByPlane(rows, tree.stages)
    const full = sumSectionSubtotalsNet(sectionSubtotalsForView(rows, tree.stages, 'client'))

    expect(due.combined).toBeCloseTo(72) // tylko etap 100: (2 + 4) · 12
    expect(due.combined).toBeLessThan(full)
    expect(due.hasUnconfirmedPlane).toBe(true)
  })

  // The przedmiar has no plane, so the overshoot highlight must not blink on and off as the user
  // switches views — it is hard-anchored to the client pomiar.
  it('przekroczenie przedmiaru jest niezależne od widoku', () => {
    const tree = makePlaneTree(mixed)
    const [row1] = treeToRows(tree) // przedmiar 5, Σ etapów 5 → brak przekroczenia
    expect(hasStagesOverPlanned(row1, tree.stages)).toBe(false)

    const over = makePlaneTree(mixed, {
      progress: [
        { itemId: 1, stageId: 100, qtyDone: 2 },
        { itemId: 1, stageId: 101, qtyDone: 9 },
      ],
    })
    const [overRow] = treeToRows(over)
    expect(hasStagesOverPlanned(overRow, over.stages)).toBe(true)
  })

  // Measured against the Aktualizacja przedmiaru (EX-921): Σ etapów 5 against ofertowy 5.
  it('przekroczenie liczy się względem aktualizacji przedmiaru, nie ofertowego', () => {
    const withCurrent = (currentPlannedQty: number) => {
      const tree = makePlaneTree(mixed)
      tree.sections[0].items[0].currentPlannedQty = currentPlannedQty
      return hasStagesOverPlanned(treeToRows(tree)[0], tree.stages)
    }
    expect(withCurrent(4)).toBe(true)
    expect(withCurrent(8)).toBe(false)
  })
})
