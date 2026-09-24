import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogueCompareDialog } from '@/components/kosztorys/editor/dialogs/catalogue-compare-dialog'
import { CATALOGUE_DIVERGENCE_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { editorNoun } from '@/lib/kosztorys/editor-noun'
import type { CatalogueComparisonT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const setOpen = vi.fn()
const toggleConditionExclusive = vi.fn()
const handleAcceptCatalogueName = vi.fn().mockResolvedValue(true)
let engagedConditionIds = new Set<string>()
let catalogueComparison: CatalogueComparisonT | null = null
let workCatalogue: WorkCatalogueItemT[] = []

vi.mock('@/components/kosztorys/editor/actions/kosztorys-actions-context', () => ({
  useKosztorysActions: () => ({ catalogueCompare: { open: true, setOpen } }),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    readOnly: false,
    catalogueComparison,
    workCatalogue,
    handleAcceptCatalogueName,
    engagedConditionIds,
    toggleConditionExclusive,
    noun: editorNoun(undefined),
  }),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const COMPARISON: CatalogueComparisonT = {
  matching: 3,
  diffs: [
    {
      itemId: 11,
      description: 'Gładzie gipsowe',
      unit: 'm2',
      clientPrice: 50,
      figures: [
        {
          label: 'Cena j.m.',
          field: 'clientPrice',
          kosztorys: 50,
          catalogue: 45,
          delta: 5,
          kosztorysSource: 'amount',
          catalogueSource: 'amount',
          kosztorysCoeff: null,
          catalogueCoeff: null,
        },
      ],
      maxDelta: 5,
    },
  ],
  missing: [],
}

const SHOW_IN_ROZPISKA = 'Pokaż w rozpisce'

beforeEach(() => {
  vi.clearAllMocks()
  engagedConditionIds = new Set()
  catalogueComparison = COMPARISON
  workCatalogue = []
})

describe('CatalogueCompareDialog — „Pokaż w rozpisce"', () => {
  it('engages the katalog problem and closes the window', async () => {
    render(<CatalogueCompareDialog />)

    await userEvent.click(await screen.findByRole('button', { name: SHOW_IN_ROZPISKA }))

    expect(toggleConditionExclusive).toHaveBeenCalledWith(
      CATALOGUE_DIVERGENCE_CONDITION_ID,
      PROBLEM_IDS,
    )
    expect(setOpen).toHaveBeenCalledWith(false)
  })

  it('leaves an already engaged problem engaged', async () => {
    engagedConditionIds = new Set([CATALOGUE_DIVERGENCE_CONDITION_ID])
    render(<CatalogueCompareDialog />)

    await userEvent.click(await screen.findByRole('button', { name: SHOW_IN_ROZPISKA }))

    expect(toggleConditionExclusive).not.toHaveBeenCalled()
    expect(setOpen).toHaveBeenCalledWith(false)
  })

  // The window owns the wiring — including that the candidates come from the window's own lazy
  // scoring pass, not from the comparison it was handed. What a click DOES is the list's own spec.
  it('podaje przyjęcie kandydata do edytora wraz z jednostką', async () => {
    catalogueComparison = {
      ...COMPARISON,
      // No diffs: both folds open with „Pokaż 1 …", and the one being clicked here is the braki one.
      diffs: [],
      missing: [
        {
          itemId: 21,
          section: 'Łazienka',
          description: 'Montaż syfonów',
          unit: 'kpl',
          hints: [],
        },
      ],
    }
    workCatalogue = [
      {
        id: 7,
        description: 'Montaż syfonu',
        category: null,
        unit: 'szt',
        clientPrice: 45,
        wToolsRate: null,
        wToolsRateCoeff: null,
        ownToolsRate: null,
        ownToolsRateCoeff: null,
        matchKey: catalogueKey('Montaż syfonu', 'szt'),
      },
    ]
    render(<CatalogueCompareDialog />)

    await userEvent.click(await screen.findByText(/Pokaż 1/))
    await userEvent.click(screen.getByRole('button', { name: /Montaż syfonu/ }))

    expect(handleAcceptCatalogueName).toHaveBeenCalledWith(21, {
      description: 'Montaż syfonu',
      unit: 'szt',
    })
  })

  it('names the missing cennik rather than an empty rozpiska when there is nothing to compare', async () => {
    catalogueComparison = null
    render(<CatalogueCompareDialog />)

    expect(await screen.findByText('Brak katalogu prac do porównania.')).toBeInTheDocument()
  })
})
