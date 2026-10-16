import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { NOOP_UNDO_REDO } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  CATALOGUE_DIVERGENCE_CONDITION_ID,
  CATALOGUE_MISSING_CONDITION_ID,
} from '@/lib/kosztorys/row-conditions/registry'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

vi.mock('@/lib/actions/kosztorys', () => ({
  addItemAction: vi.fn(),
  clearKosztorysAction: vi.fn(),
  writeKosztorysLayoutAction: vi.fn(),
  addSectionAction: vi.fn(),
  insertSectionAction: vi.fn(),
  removeItemAction: vi.fn(),
  removeSectionAction: vi.fn(),
  renumberKosztorysOrderAction: vi.fn(),
  setStageProgressAction: vi.fn(),
  updateItemFieldAction: vi.fn(async () => ({ success: true })),
  updateSectionFieldAction: vi.fn(),
  updateInvestmentCoeffsAction: vi.fn(),
  updateInvestmentGlobalDiscountAction: vi.fn(),
  updateInvestmentMaterialsNetRateAction: vi.fn(),
  updateInvestmentSettlementModeAction: vi.fn(),
  updateInvestmentVatAction: vi.fn(),
  applyPercentDiscountToAllItemsAction: vi.fn(),
}))

const TREE = makeTree({
  sections: [
    {
      id: 10,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [
        // Both stawki „auto" on both sides, so the cena j.m. is the only difference — otherwise the
        // counter would stay at 1 over the stawki and say nothing about the cena being corrected.
        {
          ...baseItem,
          id: 1,
          description: 'Malowanie ścian',
          plannedQty: 10,
          clientPrice: 100,
          wToolsOverrideValue: null,
          ownToolsOverrideValue: null,
        },
        { ...baseItem, id: 2, description: 'Montaż rolet', plannedQty: 4, clientPrice: 300 },
      ],
    },
  ],
})

const CATALOGUE: WorkCatalogueItemT[] = [
  {
    id: 1,
    description: 'Malowanie ścian',
    descriptionTranslations: {},
    category: null,
    unit: 'm2',
    clientPrice: 120,
    wToolsRate: null,
    wToolsRateCoeff: null,
    ownToolsRate: null,
    ownToolsRateCoeff: null,
    matchKey: catalogueKey('Malowanie ścian', 'm2'),
    workNote: null,
  },
]

const renderEditor = (workCatalogue?: WorkCatalogueItemT[]) =>
  renderHook(() =>
    useKosztorysEditor({
      investmentId: 1,
      tree: TREE,
      undoRedo: NOOP_UNDO_REDO,
      workCatalogue,
    }),
  )

const countOf = (result: { current: ReturnType<typeof useKosztorysEditor> }, id: string) =>
  result.current.conditionCounts.get(id)

describe('problemy katalogowe w edytorze', () => {
  it('liczą prawdę już przy wejściu, bez otwierania okna porównania', () => {
    const { result } = renderEditor(CATALOGUE)

    expect(countOf(result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(1)
    expect(countOf(result, CATALOGUE_MISSING_CONDITION_ID)).toBe(1)
  })

  it('licznik topnieje po poprawieniu ceny, bez zapisu i bez przeładowania', () => {
    const { result } = renderEditor(CATALOGUE)
    const rows = result.current.rows

    act(() => {
      result.current.onChange(
        rows.map((row) => (row.id === 1 ? { ...row, clientPrice: 120 } : row)),
      )
    })

    expect(countOf(result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(0)
    expect(countOf(result, CATALOGUE_MISSING_CONDITION_ID)).toBe(1)
  })

  it('po remoncie licznik liczy od nowa z drzewa, nie dziedziczy poprzedniego', () => {
    const first = renderEditor(CATALOGUE)
    act(() => {
      first.result.current.onChange(
        first.result.current.rows.map((row) => (row.id === 1 ? { ...row, clientPrice: 120 } : row)),
      )
    })
    expect(countOf(first.result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(0)
    first.unmount()

    const { result } = renderEditor(CATALOGUE)
    expect(countOf(result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(1)
  })

  it('bez katalogu oba problemy milczą zamiast zgłaszać całą rozpiskę', () => {
    const { result } = renderEditor(undefined)

    expect(countOf(result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(0)
    expect(countOf(result, CATALOGUE_MISSING_CONDITION_ID)).toBe(0)
  })
})
