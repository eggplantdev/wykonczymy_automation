import { describe, expect, it } from 'vitest'
import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

// EX-885: a „Pozostało" past the przedmiar is red, on exactly the rows its footer total leaves out.

const OVERRUN = 1
const OWED = 2
// Executed a hair past its przedmiar: −0.003 zł at the client price, −0.0036 zł at the stawka.
const FLOAT_NOISE = 3

const tree = makeTree({
  sections: [
    {
      id: 10,
      name: 'Prace dodatkowe',
      displayOrder: 0,
      color: null,
      items: [
        { ...baseItem, id: OVERRUN, description: 'extra', plannedQty: 0, clientPrice: 800 },
        { ...baseItem, id: OWED, description: 'owed', plannedQty: 2, clientPrice: 100 },
        { ...baseItem, id: FLOAT_NOISE, description: 'noise', plannedQty: 1, clientPrice: 10 },
      ],
    },
  ],
  stages: [{ id: 100, ordinal: 1, label: null, plane: 'w_tools', workerId: null }],
  progress: [
    { itemId: OVERRUN, stageId: 100, qtyDone: 1 },
    { itemId: OWED, stageId: 100, qtyDone: 1 },
    { itemId: FLOAT_NOISE, stageId: 100, qtyDone: 1.0003 },
  ],
})
const rows = treeToRows(tree)
const row = (id: number) => rows.find((candidate) => candidate.id === id) as KosztorysV2RowT

type ToneDataT = { tone: (r: KosztorysV2RowT) => string }

const ownerColumns = buildV2Columns({ view: 'client', stages: tree.stages })
const workerColumns = buildV2Columns({
  view: 'w_tools',
  stages: tree.stages,
  workerSurface: {
    plane: 'w_tools',
    hiddenColumns: [],
    columnRanks: {},
    executedQtyByItem: { [OVERRUN]: 1, [OWED]: 1, [FLOAT_NOISE]: 1.0003 },
  },
})

const toneOf = (columns: typeof ownerColumns, columnId: string) => {
  const column = columns.find((candidate) => candidate.id === columnId)
  return (column?.columnData as ToneDataT).tone
}

describe('„Pozostało" overrun tone', () => {
  it.each([
    ['remaining', ownerColumns],
    ['remainingGross', ownerColumns],
    ['remainingForPlane', workerColumns],
  ] as const)('%s is red only past the przedmiar', (columnId, columns) => {
    const tone = toneOf(columns, columnId)

    expect(tone(row(OVERRUN))).toBe('danger')
    expect(tone(row(OWED))).toBe('muted')
    expect(tone(row(FLOAT_NOISE))).toBe('muted')
  })
})
