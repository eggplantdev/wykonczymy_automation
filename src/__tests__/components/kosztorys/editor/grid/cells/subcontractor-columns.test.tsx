import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  subcontractorModeColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import type { KosztorysV2RowT, ViewPricingT } from '@/lib/kosztorys/types'
import { pricingRow } from '@/__tests__/fixtures/subcontractor-pricing-row'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const VIEW = 'w_tools'

const PRICE_COLUMN = subcontractorPriceColumn(VIEW, 'Cena j.m.')
const MODE_COLUMN = subcontractorModeColumn(VIEW, 'Źródło')
const PriceCell = PRICE_COLUMN.component as React.ComponentType<Record<string, unknown>>
const ModeCell = MODE_COLUMN.component as React.ComponentType<Record<string, unknown>>

const ROW = pricingRow()

const DERIVED_PRICE = '65'

// The two cells share one row, which is the whole point: „Źródło" stores nothing of its own — it
// reads the same field the price writes — so the pair is only ever observable together.
function CellPair({ override }: { override?: number | null }) {
  const [row, setRow] = useState<ViewPricingT>({ ...ROW, wToolsOverrideValue: override ?? null })
  const props = {
    rowData: row as KosztorysV2RowT,
    setRowData: setRow as (row: KosztorysV2RowT) => void,
    disabled: false,
    stopEditing: vi.fn(),
  }
  return (
    <>
      <PriceCell {...props} columnData={PRICE_COLUMN.columnData} focus />
      <ModeCell {...props} columnData={MODE_COLUMN.columnData} focus={false} />
    </>
  )
}

function renderPair(override?: number | null) {
  render(<CellPair override={override} />)
  return {
    user: userEvent.setup(),
    price: screen.getByRole('textbox'),
    source: () => screen.getByRole('button').textContent,
  }
}

// EX-766 collapsed the source pair into one nullable column, so `null` („ask the investment") and
// `0` („zero złotych") are the same field holding two different answers — and the source label is
// derived from it rather than stored. A falsy test in place of the `=== null` one reads an explicit
// zero as „auto", which is how a crew ends up billed at the mnożnik rate nobody chose.
describe('„Źródło ceny wykonawcy" — derived from the price, so 0 zł is not „auto"', () => {
  it('reads „auto" and shows the rate the investment derives', () => {
    const { price, source } = renderPair()

    expect(source()).toContain('auto')
    expect(price).toHaveValue(DERIVED_PRICE)
  })

  it('turns a typed price into „kwota stała" without visiting the picker', async () => {
    const { user, price, source } = renderPair()

    await user.clear(price)
    await user.type(price, '70')
    await user.tab()

    expect(source()).toContain('kwota stała')
    expect(price).toHaveValue('70')
  })

  it('reads an explicit 0 zł as „kwota stała", not as „auto"', () => {
    const { price, source } = renderPair(0)

    expect(source()).toContain('kwota stała')
    expect(price).toHaveValue('0')
  })

  it('sends an emptied price back to „auto" and to the derived rate, not to zero', async () => {
    const { user, price, source } = renderPair(70)

    await user.clear(price)
    await user.tab()

    expect(source()).toContain('auto')
    expect(price).toHaveValue(DERIVED_PRICE)
  })

  it('freezes the rate on screen when the picker switches to „kwota stała"', async () => {
    const { user, price, source } = renderPair()

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /kwota stała/ }))

    expect(source()).toContain('kwota stała')
    expect(price).toHaveValue(DERIVED_PRICE)
  })

  it('hands the row back to the investment when the picker switches to „auto"', async () => {
    const { user, price, source } = renderPair(70)

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /auto/ }))

    expect(source()).toContain('auto')
    expect(price).toHaveValue(DERIVED_PRICE)
  })
})
