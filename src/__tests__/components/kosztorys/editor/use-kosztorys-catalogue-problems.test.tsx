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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))
// The grid's writes are irrelevant here — the risk is the counter, which is recomputed off `rows`
// before any of them lands. The stubbed 'use server' module throws on call, so they are replaced.
vi.mock('@/lib/actions/kosztorys', () => ({
  addItemAction: vi.fn(),
  addSectionAction: vi.fn(),
  insertItemAction: vi.fn(),
  insertSectionAction: vi.fn(),
  removeItemAction: vi.fn(),
  removeSectionAction: vi.fn(),
  renumberKosztorysOrderAction: vi.fn(),
  setStageProgressAction: vi.fn(),
  swapItemOrderAction: vi.fn(),
  swapSectionOrderAction: vi.fn(),
  updateItemFieldAction: vi.fn(async () => ({ success: true })),
  updateSectionFieldAction: vi.fn(),
  updateInvestmentCoeffsAction: vi.fn(),
  updateInvestmentGlobalDiscountAction: vi.fn(),
  updateInvestmentMaterialsNetRateAction: vi.fn(),
  updateInvestmentSettlementModeAction: vi.fn(),
  updateInvestmentVatAction: vi.fn(),
  applyPercentDiscountToAllItemsAction: vi.fn(),
}))

// The rozjazd counter is the whole point of carrying the cennik into the browser: it has to be true
// on page entry and shrink as the owner types, without a save and without a reload. A node spec can
// assert the engine; only a rendered hook can assert that the counter is recomputed at all.
const TREE = makeTree({
  sections: [
    {
      id: 10,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [
        // Obie stawki „auto" po obu stronach, więc jedyną różnicą jest cena j.m. — inaczej licznik
        // zostałby na 1 z powodu stawek i test nie powiedziałby nic o poprawianej cenie.
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
    category: null,
    unit: 'm2',
    clientPrice: 120,
    wToolsRate: null,
    ownToolsRate: null,
    matchKey: catalogueKey('Malowanie ścian', 'm2'),
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
    // Nietknięta: „brak w katalogu" to inne pytanie niż zgodność liczb.
    expect(countOf(result, CATALOGUE_MISSING_CONDITION_ID)).toBe(1)
  })

  // Remount to sposób, w jaki edytor wchłania przywróconą wersję (use-restore-remount): ziarno
  // `rows` jest zamrożone przy montowaniu, więc świeży montaż ma liczyć od nowa z drzewa, a nie
  // odziedziczyć licznik po poprzednim.
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

  // Brak cennika to brak licznika, a nie pusty cennik — ten drugi zgłosiłby całą rozpiskę jako
  // spoza katalogu, co jest kłamstwem na powierzchni, która cennika w ogóle nie wozi.
  it('bez katalogu oba problemy milczą zamiast zgłaszać całą rozpiskę', () => {
    const { result } = renderEditor(undefined)

    expect(countOf(result, CATALOGUE_DIVERGENCE_CONDITION_ID)).toBe(0)
    expect(countOf(result, CATALOGUE_MISSING_CONDITION_ID)).toBe(0)
  })
})
