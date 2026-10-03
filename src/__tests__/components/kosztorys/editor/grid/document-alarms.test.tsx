import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { buildV2Columns } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { pricingRow } from '@/__tests__/fixtures/subcontractor-pricing-row'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

// Red is the owner's alarm — a figure out of bounds, an etap nobody settles. The investor's and the
// worker's documents are read by people who can act on none of it, and the ceiling's sentence names
// the client price outright, so neither document may carry an alarm of any kind.

const OVERRUN = 1
const tree = makeTree({
  sections: [
    {
      id: 10,
      name: 'Prace dodatkowe',
      displayOrder: 0,
      color: null,
      items: [{ ...baseItem, id: OVERRUN, description: 'extra', plannedQty: 0, clientPrice: 800 }],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null, plane: 'w_tools', split: null },
    { id: 101, ordinal: 2, label: null, plane: null, split: null },
  ],
  progress: [
    { itemId: OVERRUN, stageId: 100, qtyDone: 1 },
    { itemId: OVERRUN, stageId: 101, qtyDone: 1 },
  ],
})
const overrunRow = treeToRows(tree)[0] as KosztorysV2RowT

const workerColumns = buildV2Columns({
  view: 'w_tools',
  stages: tree.stages.filter((stage) => stage.plane === 'w_tools'),
  readOnly: true,
  workerSurface: {
    plane: 'w_tools',
    hiddenColumns: [],
    columnRanks: {},
    executedQtyByItem: { [OVERRUN]: 1 },
  },
})
const investorColumns = buildV2Columns({
  view: 'client',
  stages: tree.stages,
  readOnly: true,
  previewVisible: true,
})

type ToneT = string | ((row: KosztorysV2RowT) => string)

const tonesOf = (columns: typeof workerColumns) =>
  columns.flatMap((column) => {
    const tone = (column.columnData as { tone?: ToneT } | undefined)?.tone
    if (tone == null) return []
    return [[column.id, typeof tone === 'function' ? tone(overrunRow) : tone] as const]
  })

describe('dokument inwestora i pracownika — bez czerwieni', () => {
  it.each([
    ['pracownik', workerColumns],
    ['inwestor', investorColumns],
  ] as const)('%s: żadna wyliczana kolumna nie świeci na czerwono', (_, columns) => {
    expect(tonesOf(columns).length).toBeGreaterThan(0)
    expect(tonesOf(columns).filter(([, tone]) => tone === 'danger')).toEqual([])
  })

  it.each([
    ['pracownik', workerColumns],
    ['inwestor', investorColumns],
  ] as const)('%s: żadna kolumna nie ma czerwonego tła ani tekstu', (_, columns) => {
    const classes = columns.flatMap((column) => [column.cellClassName, column.headerClassName])
    expect(
      classes.filter((name) => typeof name === 'string' && name.includes('destructive')),
    ).toEqual([])
  })

  it('pracownik: cena ponad sufit ani nie czerwienieje, ani nie mówi o cenie dla inwestora', async () => {
    const priceColumn = workerColumns.find(
      (column) => column.id === planePriceKey('price', 'w_tools'),
    )
    const PriceCell = priceColumn?.component as React.ComponentType<Record<string, unknown>>
    render(
      <PriceCell
        rowData={pricingRow({ wToolsOverrideValue: 90 }) as KosztorysV2RowT}
        setRowData={vi.fn()}
        columnData={priceColumn?.columnData}
        focus={false}
        disabled
        stopEditing={vi.fn()}
      />,
    )
    const input = screen.getByRole('textbox')
    await userEvent.setup().hover(input)

    expect(input).not.toHaveClass('text-destructive')
    expect(screen.queryAllByText(/ceny dla inwestora/)).toHaveLength(0)
  })
})
