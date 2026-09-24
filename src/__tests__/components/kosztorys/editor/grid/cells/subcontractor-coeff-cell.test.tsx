import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  subcontractorCoeffColumn,
  subcontractorModeColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import type { KosztorysV2RowT, ViewPricingT } from '@/lib/kosztorys/types'
import { pricingRow } from '@/__tests__/fixtures/subcontractor-pricing-row'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const VIEW = 'w_tools'

const PRICE_COLUMN = subcontractorPriceColumn(VIEW, 'Cena j.m.')
const COEFF_COLUMN = subcontractorCoeffColumn(VIEW, 'Mnożnik')
const MODE_COLUMN = subcontractorModeColumn(VIEW, 'Źródło')
const PriceCell = PRICE_COLUMN.component as React.ComponentType<Record<string, unknown>>
const CoeffCell = COEFF_COLUMN.component as React.ComponentType<Record<string, unknown>>
const ModeCell = MODE_COLUMN.component as React.ComponentType<Record<string, unknown>>

// Cena j.m. 100 at the investment's 0,65 — every figure below reads off that pair.
const ROW = pricingRow()

// The three cells share one row and store nothing of their own: the source is READ off the pair of
// columns behind them, so a source switch is only observable as all three changing together.
function CellTrio({ row: initial }: { row: Partial<ViewPricingT> }) {
  const [row, setRow] = useState<ViewPricingT>({ ...ROW, wToolsOverrideValue: null, ...initial })
  const props = {
    rowData: row as KosztorysV2RowT,
    setRowData: setRow as (row: KosztorysV2RowT) => void,
    disabled: false,
    stopEditing: vi.fn(),
  }
  return (
    <>
      <div data-testid="price">
        <PriceCell {...props} columnData={PRICE_COLUMN.columnData} focus={false} />
      </div>
      <div data-testid="coeff">
        <CoeffCell {...props} columnData={COEFF_COLUMN.columnData} focus />
      </div>
      <div data-testid="mode">
        <ModeCell {...props} columnData={MODE_COLUMN.columnData} focus={false} />
      </div>
    </>
  )
}

function renderTrio(row: Partial<ViewPricingT> = {}) {
  render(<CellTrio row={row} />)
  const cell = (id: string) => within(screen.getByTestId(id))
  return {
    user: userEvent.setup(),
    priceInput: () => cell('price').queryByRole('textbox'),
    priceText: () => screen.getByTestId('price').textContent,
    coeffInput: () => cell('coeff').queryByRole('textbox'),
    coeffText: () => screen.getByTestId('coeff').textContent,
    source: () => screen.getByTestId('mode').textContent,
  }
}

describe('„Mnożnik" — trzecie źródło stawki wykonawcy', () => {
  // Właściciel, 2026-09-23: przy „auto" wiersz JEST liczony mnożnikiem, tylko nie swoim — pusta
  // komórka czytała się jak „żadnego mnożnika tu nie ma".
  it('przy „auto" pokazuje mnożnik inwestycji, nieedytowalnie', () => {
    const { coeffInput, coeffText } = renderTrio()

    expect(coeffInput()).toBeNull()
    expect(coeffText()).toBe('0,65')
  })

  // Kreska, nie pustka: zamrożona kwota nie idzie za „Cena j.m.", więc krotność, w której akurat
  // siedzi, obiecywałaby związek zrywany pierwszą zmianą ceny — a pusta komórka czyta się jak pole
  // do wypełnienia.
  it('przy „kwocie stałej" pokazuje kreskę', () => {
    const { coeffInput, coeffText } = renderTrio({ wToolsOverrideValue: 50 })

    expect(coeffInput()).toBeNull()
    expect(coeffText()).toBe('—')
  })

  it('liczy stawkę od ceny j.m. i oddaje ją nieedytowalnej komórce ceny', () => {
    const { priceInput, priceText, coeffInput, source } = renderTrio({ wToolsOverrideCoeff: 0.8 })

    expect(source()).toContain('własny mnożnik')
    expect(coeffInput()).toHaveValue('0,8')
    // Jedna liczba, jeden autor: gdyby cena została edytowalna, wpis w niej zapisałby kwotę i po
    // cichu przestawił źródło z powrotem.
    expect(priceInput()).toBeNull()
    expect(priceText()).toBe('80')
  })

  it('mnożnik 0 to stawka zero złotych, nie powrót do „auto"', () => {
    const { priceText, source } = renderTrio({ wToolsOverrideCoeff: 0 })

    expect(source()).toContain('własny mnożnik')
    expect(priceText()).toBe('0')
  })

  it('wpisany mnożnik przesuwa stawkę bez ruszania ceny dla inwestora', async () => {
    const { user, coeffInput, priceText } = renderTrio({ wToolsOverrideCoeff: 0.8 })

    const input = coeffInput()!
    await user.clear(input)
    await user.type(input, '0,5')
    await user.tab()

    expect(priceText()).toBe('50')
  })

  it('przełączenie z „auto" nie rusza liczby na ekranie — zasiewa współczynnik inwestycji', async () => {
    const { user, coeffInput, priceText, source } = renderTrio()

    await user.click(screen.getByRole('button'))
    await user.click(await screen.findByRole('menuitem', { name: /własny mnożnik/ }))

    expect(source()).toContain('własny mnożnik')
    expect(coeffInput()).toHaveValue('0,65')
    expect(priceText()).toBe('65')
  })

  // Wiersz z OBIEMA kolumnami jest stanem, którego normalizeOverridePatch nie pozwala zapisać —
  // i o to chodzi: wyczyszczenie ma czyścić parę, a nie tylko tę komórkę, w której stoi kursor.
  it('wyczyszczenie mnożnika wraca do „auto", nie do zostawionej obok kwoty', async () => {
    const { user, coeffInput, priceInput, source } = renderTrio({
      wToolsOverrideValue: 40,
      wToolsOverrideCoeff: 0.8,
    })

    const input = coeffInput()!
    await user.clear(input)
    await user.tab()

    expect(source()).toContain('auto')
    // 65, nie 40: zostawiona kwota wystawiłaby z powrotem stawkę, którą właściciel właśnie skasował.
    expect(priceInput()).toHaveValue('65')
  })
})
