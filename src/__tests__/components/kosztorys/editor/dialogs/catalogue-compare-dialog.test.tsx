import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogueCompareDialog } from '@/components/kosztorys/editor/dialogs/catalogue-compare-dialog'
import { CATALOGUE_DIVERGENCE_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'
import type { CatalogueComparisonT } from '@/lib/kosztorys/work-catalogue/types'

const setOpen = vi.fn()
const toggleConditionExclusive = vi.fn()
let engagedConditionIds = new Set<string>()
let catalogueComparison: CatalogueComparisonT | null = null

vi.mock('@/components/kosztorys/editor/actions/kosztorys-actions-context', () => ({
  useKosztorysActions: () => ({ catalogueCompare: { open: true, setOpen } }),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    readOnly: false,
    catalogueComparison,
    workCatalogue: [],
    engagedConditionIds,
    toggleConditionExclusive,
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
      figures: [
        {
          label: 'Cena j.m.',
          kosztorys: 50,
          catalogue: 45,
          delta: 5,
          kosztorysIsAuto: false,
          catalogueIsAuto: false,
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

  it('names the missing cennik rather than an empty rozpiska when there is nothing to compare', async () => {
    catalogueComparison = null
    render(<CatalogueCompareDialog />)

    expect(await screen.findByText('Brak katalogu prac do porównania.')).toBeInTheDocument()
  })
})
