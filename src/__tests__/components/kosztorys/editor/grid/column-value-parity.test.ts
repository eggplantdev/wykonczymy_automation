import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
import type { BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { sortValueGetter } from '@/lib/kosztorys/columns/sort-value'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT, KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// A computed cell and its sort key must be one figure: EX-487 and EX-894 were each a sort ordering
// rows by a number no cell showed. Iterates the columns the grid ACTUALLY assembles, so a computed
// column added later is held to this the day it appears — no list here to forget to extend.
//
// Rows 1 and 3 order oppositely at the client price and at either stawka; row 1 carries a rabat and
// splits its pomiar across both crews; row 2 has no przedmiar; row 3 is executed past its przedmiar.
// Etap 300 has no rozliczenie, so the client view assembles its locked, computed qty column.
const tree: KosztorysTreeT = makeTree({
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
          plannedQty: 10,
          clientPrice: 100,
          discountType: 'percent',
          discountValue: 10,
          wToolsOverrideValue: null,
          ownToolsOverrideValue: 20,
        },
        {
          ...baseItem,
          id: 2,
          description: 'B',
          plannedQty: null as unknown as number,
          clientPrice: 50,
          wToolsOverrideValue: 150,
          ownToolsOverrideValue: null,
        },
        {
          ...baseItem,
          id: 3,
          description: 'C',
          plannedQty: 3,
          clientPrice: 10,
          wToolsOverrideValue: 500,
          ownToolsOverrideValue: 400,
        },
      ],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
    { id: 200, ordinal: 2, label: null, plane: 'own_tools', split: null },
    { id: 300, ordinal: 3, label: null, plane: null, split: null },
  ],
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 1 },
    { itemId: 1, stageId: 200, qtyDone: 4 },
    { itemId: 2, stageId: 100, qtyDone: 6 },
    { itemId: 3, stageId: 100, qtyDone: 2 },
    { itemId: 3, stageId: 200, qtyDone: 2 },
    { itemId: 3, stageId: 300, qtyDone: 1 },
  ],
})
const rows = treeToRows(tree)

const COMPUTED_CELL = computedColumn('probe', 'probe', () => null).component
type ComputedDataT = { compute: (row: KosztorysV2RowT) => number | null }

function computedColumnsOf(opts: BuildV2ColumnsOptsT) {
  return buildV2Columns(opts).filter((column) => column.component === COMPUTED_CELL)
}

function expectCellsMatchSort(
  columns: ReturnType<typeof computedColumnsOf>,
  view: PriceViewT,
  stages: KosztorysStageT[],
) {
  for (const column of columns) {
    const { compute } = column.columnData as ComputedDataT
    const sortKey = sortValueGetter(column.id!, view, stages)
    for (const row of rows) expect(compute(row), `${column.id} #${row.id}`).toEqual(sortKey(row))
  }
}

describe('every computed cell shows the value its column sorts by', () => {
  it.each(['client', 'w_tools', 'own_tools'] as const)('%s view', (view) => {
    const columns = computedColumnsOf({ view, stages: tree.stages })
    expectCellsMatchSort(columns, view, tree.stages)
    // A filter that matched nothing would pass vacuously.
    const ids = columns.map((column) => column.id)
    expect(ids).toEqual(
      expect.arrayContaining(['plannedNet', 'donePercent', 'remaining', 'net', 'stageQtySum']),
    )
    expect(ids).toContain(stageValueNetKey(view === 'own_tools' ? 200 : 100))
  })

  // The worker's grid is read-only and has no sort; „Pozostało" there reads a quantity the sort is
  // never handed, so it is the one column left out — every other one is the owner's figure.
  it('worker surface', () => {
    const view = 'w_tools'
    const stages = tree.stages.filter((st) => st.plane === view)
    const columns = computedColumnsOf({
      view,
      stages,
      workerSurface: {
        plane: view,
        hiddenColumns: [],
        columnRanks: {},
        executedQtyByItem: { 1: 5, 2: 6, 3: 5 },
      },
    }).filter((column) => column.id !== 'remainingForPlane')
    expect(columns.length).toBeGreaterThan(0)
    expectCellsMatchSort(columns, view, stages)
  })
})
