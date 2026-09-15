import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { subcontractorPriceColumn } from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import { toastMessage } from '@/lib/utils/toast'
import type { KosztorysV2RowT, ViewPricingT } from '@/lib/kosztorys/types'
import { pricingRow } from '@/__tests__/fixtures/subcontractor-pricing-row'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const VIEW = 'w_tools'
const PRICE_COLUMN = subcontractorPriceColumn(VIEW, 'Cena j.m.')
const PriceCell = PRICE_COLUMN.component as React.ComponentType<Record<string, unknown>>

const ROW = pricingRow()

const REFUSAL = /nie może przekroczyć 80%/

// Two rows behind one cell, because that is what the grid does: dsg recycles a cell onto whichever
// row scrolled into its slot, without ever remounting it. `rowId` is which row is under the caret
// right now; both rows stay readable so a draft settling onto the wrong one is visible.
function CellHost({
  rowId = 1,
  override = null,
  focus = true,
}: {
  rowId?: number
  override?: number | null
  focus?: boolean
}) {
  const [rows, setRows] = useState<Record<number, ViewPricingT>>({
    1: { ...ROW, wToolsOverrideValue: override },
    2: { ...ROW, id: 2, wToolsOverrideValue: null },
  })
  return (
    <>
      <PriceCell
        rowData={rows[rowId] as KosztorysV2RowT}
        setRowData={(next: KosztorysV2RowT) =>
          setRows((prev) => ({ ...prev, [next.id]: next as unknown as ViewPricingT }))
        }
        columnData={PRICE_COLUMN.columnData}
        focus={focus}
        disabled={false}
        stopEditing={stopEditing}
      />
      <output data-testid="row-1">{storedText(rows[1])}</output>
      <output data-testid="row-2">{storedText(rows[2])}</output>
    </>
  )
}

const stopEditing = vi.fn()

const storedText = (row: ViewPricingT) =>
  row.wToolsOverrideValue === null ? 'auto' : String(row.wToolsOverrideValue)

const stored = (id: 1 | 2) => screen.getByTestId(`row-${id}`).textContent

function renderCell(props: Parameters<typeof CellHost>[0] = {}) {
  const view = render(<CellHost {...props} />)
  return { ...view, user: userEvent.setup(), input: screen.getByRole('textbox') }
}

beforeEach(() => vi.clearAllMocks())

// Keystrokes commit as they go, so „9" is already on the row by the time the „0" pushes the price
// over the ceiling. Walking away must not leave that prefix standing as the price someone chose.
describe('Cena wykonawcy — wartość ponad sufitem', () => {
  it('przywraca cenę sprzed edycji i mówi o tym', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '90')
    await user.tab()

    expect(stored(1)).toBe('auto')
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringContaining('przywrócono'),
      'error',
      expect.any(Number),
    )
  })

  it('tłumaczy odmowę w miejscu, w którym user pisze — bez najeżdżania myszą', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '90')

    expect(screen.getAllByText(REFUSAL).length).toBeGreaterThan(0)
  })

  it('przyjmuje cenę dokładnie na suficie', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '80')
    await user.tab()

    expect(stored(1)).toBe('80')
    expect(toastMessage).not.toHaveBeenCalled()
  })
})

describe('Cena wykonawcy — wyjścia z edycji', () => {
  // Escape rolls the row back itself; the blur that follows must find nothing left to settle, or the
  // same draft is rozliczony dwa razy — the second time against a row that already went back.
  it('porzuca edycję po Escape i nie rozlicza jej drugi raz przy blurze', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '90{Escape}')
    await user.tab()

    expect(stored(1)).toBe('auto')
    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('zatwierdza Enterem dokładnie raz i oddaje komórkę siatce', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '70{Enter}')

    expect(stored(1)).toBe('70')
    expect(stopEditing).toHaveBeenCalledWith({ nextRow: true })
    expect(toastMessage).not.toHaveBeenCalled()

    await user.tab()
    expect(stored(1)).toBe('70')
    expect(toastMessage).not.toHaveBeenCalled()
  })
})

// The draft lives at a grid POSITION, not on a row — and the row underneath it changes without the
// cell ever losing focus. Row 1's snapshot landing on row 2 would re-price a crew nobody edited.
describe('Cena wykonawcy — wiersz podmieniony pod kursorem', () => {
  it('nie rozlicza szkicu na wierszu, który wjechał w to miejsce', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CellHost />)

    await user.type(screen.getByRole('textbox'), '90')
    rerender(<CellHost rowId={2} />)
    await user.tab()

    expect(stored(2)).toBe('auto')
    expect(toastMessage).not.toHaveBeenCalled()
  })
})

// EX-422: the tooltip's tree shape is fixed on purpose. Letting the verdict change the element type
// at that position unmounts the subtree — i.e. the input being typed into — one keystroke after the
// price crosses the ceiling.
describe('Cena wykonawcy — werdykt w trakcie pisania', () => {
  it('nie przemontowuje inputa, gdy odmowa pojawia się pod palcami', async () => {
    const { user, input } = renderCell()

    await user.clear(input)
    await user.type(input, '90')
    await user.type(input, '5')

    expect(screen.getByRole('textbox')).toBe(input)
    expect(input).toHaveFocus()
    expect(input).toHaveValue('905')
  })
})

// A breach can arrive from outside these columns (a lowered client price, a raised mnożnik), so the
// cell carries the standing verdict too — and a keyboard user entering it gets the sentence, not
// just a red figure.
describe('Cena wykonawcy — stojący werdykt', () => {
  it('odsłania zdanie, gdy siatka wchodzi w odrzuconą komórkę', () => {
    const { rerender } = render(<CellHost override={90} focus={false} />)
    expect(screen.queryAllByText(REFUSAL)).toHaveLength(0)

    rerender(<CellHost override={90} focus />)
    expect(screen.getAllByText(REFUSAL).length).toBeGreaterThan(0)
  })
})
