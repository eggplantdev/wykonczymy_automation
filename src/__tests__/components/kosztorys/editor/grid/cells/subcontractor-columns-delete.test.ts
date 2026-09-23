import { describe, expect, it } from 'vitest'
import type { Column } from 'react-datasheet-grid'
import {
  subcontractorCoeffColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import { priceSourceOf } from '@/lib/kosztorys/calc'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Tylko para kolumn cenowych gra rolę w tym, która komórka może pisać — reszta wiersza jest wypełniona
// do typu, nie do testu.
const row = (overrides: Partial<KosztorysV2RowT>): KosztorysV2RowT =>
  ({
    id: 1,
    clientPrice: 100,
    wToolsOverrideValue: null,
    wToolsOverrideCoeff: null,
    ownToolsOverrideValue: null,
    ownToolsOverrideCoeff: null,
    ...overrides,
  }) as KosztorysV2RowT

const coeffCell = subcontractorCoeffColumn('w_tools', null)
const priceCell = subcontractorPriceColumn('w_tools', null)

// Reguła, którą react-datasheet-grid stosuje przed KAŻDYM zapisem — Delete (DataSheetGrid.js:377),
// wklejaniem (:515) i wejściem w edycję (:1036). Odtworzona tu, bo to ona jest zachowaniem, a nie
// `deleteValue` samo w sobie.
const writable = (column: Column<KosztorysV2RowT>, rowData: KosztorysV2RowT) =>
  !(typeof column.disabled === 'function'
    ? column.disabled({ rowData, rowIndex: 0 })
    : column.disabled)

// Zapis tak, jak go widzi siatka: skasowanie zaznaczenia obejmującego tę komórkę.
const del = (column: Column<KosztorysV2RowT>, rowData: KosztorysV2RowT) =>
  writable(column, rowData) ? (column.deleteValue?.({ rowData, rowIndex: 0 }) ?? rowData) : rowData

describe('stawka wykonawcy — pisać może tylko komórka, która jest autorem figury', () => {
  it('Delete na „Mnożniku" wiersza z kwotą stałą nie rusza kwoty', () => {
    const kwotaStala = row({ wToolsOverrideValue: 55 })
    expect(priceSourceOf(kwotaStala, 'w_tools')).toBe('amount')

    expect(del(coeffCell, kwotaStala)).toEqual(kwotaStala)
  })

  it('Delete na „Cenie j.m." wiersza z własnym mnożnikiem nie rusza mnożnika', () => {
    const wlasnyMnoznik = row({ wToolsOverrideCoeff: 0.8 })
    expect(priceSourceOf(wlasnyMnoznik, 'w_tools')).toBe('coeff')

    expect(del(priceCell, wlasnyMnoznik)).toEqual(wlasnyMnoznik)
  })

  it('komórka, która nie jest autorem, jest dla siatki wyłączona — nie da się w nią wejść ani wkleić', () => {
    expect(writable(coeffCell, row({ wToolsOverrideValue: 55 }))).toBe(false)
    expect(writable(priceCell, row({ wToolsOverrideCoeff: 0.8 }))).toBe(false)
  })

  it('autor figury dalej kasuje ją z powrotem na „auto"', () => {
    const kwotaStala = row({ wToolsOverrideValue: 55 })
    const wlasnyMnoznik = row({ wToolsOverrideCoeff: 0.8 })

    expect(priceSourceOf(del(priceCell, kwotaStala), 'w_tools')).toBe('auto')
    expect(priceSourceOf(del(coeffCell, wlasnyMnoznik), 'w_tools')).toBe('auto')
  })

  it('na „auto" kwota jest do wpisania, a mnożnik tylko wyliczony', () => {
    const auto = row({})
    expect(priceSourceOf(auto, 'w_tools')).toBe('auto')

    expect(writable(priceCell, auto)).toBe(true)
    expect(writable(coeffCell, auto)).toBe(false)
  })
})
