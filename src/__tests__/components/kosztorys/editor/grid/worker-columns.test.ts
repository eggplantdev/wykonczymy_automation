import { describe, expect, it } from 'vitest'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  buildV2Columns,
  buildV2Grid,
} from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'

// The worker's document: a closed list at his plane. Asserted on rendered ids, like the investor's
// preview, because the ids are what reaches his screen.

// Already narrowed to his etapy, as the projection hands them over.
const STAGES: KosztorysStageT[] = [
  { id: 7, ordinal: 1, label: 'Etap 1', plane: 'w_tools', workerId: 3 },
]

function workerOpts(
  plane: ToolPlaneT = 'w_tools',
  hiddenColumns: string[] = [],
): Pick<BuildV2ColumnsOptsT, 'view' | 'stages' | 'workerSurface'> {
  return {
    view: plane,
    stages: STAGES,
    workerSurface: { plane, hiddenColumns, executedQtyByItem: {} },
  }
}

function workerIds(extra: Partial<BuildV2ColumnsOptsT> = {}, hidden: string[] = []): string[] {
  return buildV2Columns({ ...workerOpts('w_tools', hidden), ...extra })
    .map((column) => column.id)
    .filter((id): id is string => id != null)
}

describe('worker columns', () => {
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

  it('offers no column picker', () => {
    expect(buildV2Grid(workerOpts()).columnToggleItems).toEqual([])
  })

  it('resolves the stawka to the own-tools plane for an own-tools worker', () => {
    const visible = buildV2Columns(workerOpts('own_tools')).map((column) => column.id)

    expect(visible).toContain(planePriceKey('price', 'own_tools'))
    expect(visible).not.toContain(planePriceKey('price', 'w_tools'))
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
