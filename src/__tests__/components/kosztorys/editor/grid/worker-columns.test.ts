import { describe, expect, it } from 'vitest'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { ColumnRanksT } from '@/lib/table/column-order'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-worker-split'

// The worker's document: a closed list at his plane. Asserted on rendered ids, like the investor's
// preview, because the ids are what reaches his screen.

// Already narrowed to his etapy, as the projection hands them over.
const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: 'w_tools', split: oneWorkerSplit(3) },
]

function workerOpts(
  plane: ToolPlaneT = 'w_tools',
  hiddenColumns: string[] = [],
  columnRanks: ColumnRanksT = {},
): Pick<BuildV2ColumnsOptsT, 'view' | 'stages' | 'workerSurface'> {
  return {
    view: plane,
    stages: STAGES,
    workerSurface: { plane, hiddenColumns, columnRanks, executedQtyByItem: {} },
  }
}

function workerIds(extra: Partial<BuildV2ColumnsOptsT> = {}, hidden: string[] = []): string[] {
  return buildV2Columns({ ...workerOpts('w_tools', hidden), ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('worker columns', () => {
  it('reads the przedmiar as ilość, j.m., cena, wartość at their stawka', () => {
    const visible = workerIds()
    const at = visible.indexOf('plannedQty')

    expect(visible.slice(at, at + 4)).toEqual([
      'plannedQty',
      'unit',
      planePriceKey('price', 'w_tools'),
      'plannedNetForPlane',
    ])
  })

  it('renders his stawka, his values and the all-etapy „Pozostało"', () => {
    const visible = workerIds()
    for (const id of [
      'description',
      'plannedQty',
      'stageQtySum',
      'unit',
      planePriceKey('price', 'w_tools'),
      'plannedNetForPlane',
      'net',
      'remainingForPlane',
      'stage_7',
      'stageValueNet_7',
    ]) {
      expect(visible).toContain(id)
    }
  })

  // Each is money that is not his: the client's price and przedmiar value, the other crew's stawka,
  // the rabat (a client concession), brutto, and the client-anchored „Pozostało".
  it('never reaches the client money or the other crew', () => {
    const visible = workerIds()
    for (const id of [
      'price',
      'plannedNet',
      'gross',
      'remaining',
      'discountType',
      'discountValue',
      'discountAmount',
      'stageValueGross_7',
      'note',
      planePriceKey('price', 'own_tools'),
    ]) {
      expect(visible).not.toContain(id)
    }
  })

  it('carries no Źródło or Mnożnik, in either plane', () => {
    const visible = workerIds()
    for (const plane of ['w_tools', 'own_tools'] as const) {
      expect(visible).not.toContain(planePriceKey('priceMode', plane))
      expect(visible).not.toContain(planePriceKey('priceCoeff', plane))
    }
  })

  // The hidden set only subtracts: naming a column outside the ceiling is inert, not a way in.
  it('cannot let a stored key add a column outside the list', () => {
    expect(workerIds({}, ['price', 'plannedNet', 'gross'])).toEqual(workerIds())
  })

  it('drops the columns the owner hid, the stawka under its plane-agnostic key', () => {
    const visible = workerIds({}, ['rate', 'remainingForPlane'])

    expect(visible).not.toContain(planePriceKey('price', 'w_tools'))
    expect(visible).not.toContain('remainingForPlane')
    expect(visible).toContain('net')
  })

  it('is not narrowed or reordered by any owner reading preference', () => {
    const baseline = workerIds()
    const preferences: Partial<BuildV2ColumnsOptsT>[] = [
      { moneyAxis: 'gross' },
      { layer: 'progress' },
      { isHidden: () => true },
      { crewAxis: 'own_tools' },
      { columnRanks: { net: 0, description: 99 } },
    ]
    for (const opts of preferences) expect(workerIds(opts)).toEqual(baseline)
  })

  it("follows the owner's stored order, the stawka under its plane-agnostic key", () => {
    const ids = (ranks: ColumnRanksT) =>
      buildV2Columns(workerOpts('w_tools', [], ranks)).map((column) => column.id)
    const visible = ids({ net: -2, rate: -1 })

    expect(visible.slice(0, 3)).toEqual(['description', 'net', planePriceKey('price', 'w_tools')])
  })

  it('keeps „Opis prac" first whatever rank it is given', () => {
    const visible = buildV2Columns(workerOpts('w_tools', [], { description: 99, net: -1 })).map(
      (column) => column.id,
    )

    expect(visible.slice(0, 2)).toEqual(['description', 'net'])
  })

  it('offers no column picker', () => {
    expect(buildV2Grid(workerOpts()).columnToggleItems).toEqual([])
  })

  it('resolves the stawka to the own-tools plane for an own-tools worker', () => {
    const visible = buildV2Columns(workerOpts('own_tools')).map((column) => column.id)

    expect(visible).toContain(planePriceKey('price', 'own_tools'))
    expect(visible).not.toContain(planePriceKey('price', 'w_tools'))
  })
})

// The link and the owner's Podgląd subtract the rule the PDF prints by (`workerDataHiddenColumns`).
describe('worker columns the data takes off', () => {
  const stages: KosztorysStageT[] = [
    ...STAGES,
    { id: 9, ordinal: 2, label: 'Etap 2', plane: 'w_tools', split: oneWorkerSplit(3) },
  ]
  const stageRow = (overrides: Parameters<typeof row>[0] = {}) =>
    row({ [stageKey(7)]: 0, [stageKey(9)]: 0, ...overrides })
  const idsFor = (rows: ReturnType<typeof stageRow>[], hidePlannedOnceExecuted: boolean) =>
    workerIds({
      stages,
      documentHiddenColumns: workerDataHiddenColumns(rows, stages, hidePlannedOnceExecuted),
    })

  it('shows the offer shape before any entry', () => {
    const visible = idsFor([stageRow()], true)

    expect(visible).toContain('plannedQty')
    expect(visible).toContain('plannedNetForPlane')
    for (const id of ['stageQtySum', 'net', 'stage_7', 'stage_9', 'stageValueNet_7']) {
      expect(visible).not.toContain(id)
    }
  })

  it('once an etap has an entry: przedmiar off, that etap on, the empty one still off', () => {
    const visible = idsFor([stageRow({ [stageKey(7)]: 2 })], true)

    expect(visible).not.toContain('plannedQty')
    expect(visible).not.toContain('plannedNetForPlane')
    for (const id of ['stage_7', 'stageValueNet_7', 'stageQtySum', 'net', 'remainingForPlane']) {
      expect(visible).toContain(id)
    }
    expect(visible).not.toContain('stage_9')
    expect(visible).not.toContain('stageValueNet_9')
  })

  it('keeps the przedmiar beside the settlement with the checkbox off', () => {
    const visible = idsFor([stageRow({ [stageKey(7)]: 2 })], false)

    expect(visible).toContain('plannedQty')
    expect(visible).toContain('plannedNetForPlane')
    expect(visible).toContain('net')
  })
})

// The list names `price__<plane>`, but `net` and the per-etap values compute at `view` — at 'client'
// they would print the client's money under his stawka.
describe('the pair: worker list + price plane', () => {
  it('throws unless view is the worker plane', () => {
    expect(() => buildV2Columns({ ...workerOpts('w_tools'), view: 'client' })).toThrow(
      /workerSurface requires view='w_tools'/,
    )
    expect(() => buildV2Columns({ ...workerOpts('w_tools'), view: 'own_tools' })).toThrow()
  })

  it('refuses both audiences at once', () => {
    expect(() =>
      buildV2Columns({ ...workerOpts('w_tools'), previewVisible: true, view: 'w_tools' }),
    ).toThrow()
  })
})
