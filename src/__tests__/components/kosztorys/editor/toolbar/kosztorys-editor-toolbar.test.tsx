import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { CataloguePickerHost } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { MediaFileT } from '@/types/media'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

// The gallery's actions are `'use server'`, and the harness swaps those for stubs that THROW when
// called. Nothing in this spec calls them, but the modules are imported eagerly.
vi.mock('@/lib/actions/investment-assets', () => ({
  addInvestmentAssetsAction: vi.fn(),
  removeInvestmentAssetAction: vi.fn(),
  removeAllInvestmentAssetsAction: vi.fn(),
}))

const PHOTO: MediaFileT = {
  id: 1,
  url: '/api/media/file/salon.jpg',
  filename: 'salon.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: null,
}

type EditorContextT = Parameters<typeof KosztorysEditorProvider>[0]['editor']

// Only the fields the toolbar and its menus read on the way to first paint. The cast is the point:
// the editor context is the whole hook's return, and widening this stub to match it would be a
// second implementation of the editor rather than a test of the toolbar.
const editorContext = {
  investmentId: 7,
  investmentName: 'Testowa',
  tree: { revision: '1', sections: [] },
  search: '',
  setSearch: vi.fn(),
  view: 'client',
  setView: vi.fn(),
  moneyAxis: 'netto',
  setMoneyAxis: vi.fn(),
  layer: 'all',
  setLayer: vi.fn(),
  subtotals: [],
  readOnly: false,
  isWorkshop: false,
  noun: { accusative: 'kosztorys' },
  hasSheet: false,
  globalDiscount: { type: null, value: 0 },
  engagedConditionIds: new Set<string>(),
  conditionCounts: new Map<string, number>(),
  toggleCondition: vi.fn(),
  toggleConditionExclusive: vi.fn(),
  refreshProblemRows: vi.fn(),
  resetFilters: vi.fn(),
  collapsedSectionIds: new Set<number>(),
  storedCollapsedSectionIds: new Set<number>(),
  setCollapsedSectionIds: vi.fn(),
  foldableSectionIds: new Map<string, Set<number>>(),
  columnToggleItems: [],
  revealedColumnIds: new Set<string>(),
  toggleColumn: vi.fn(),
  setAllColumns: vi.fn(),
  columnRanks: new Map<string, number>(),
  columnBaseRanks: new Map<string, number>(),
  setColumnRank: vi.fn(),
  resetColumnOrder: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  canUndo: false,
  canRedo: false,
  fitRowsToContent: false,
  toggleFitRowsToContent: vi.fn(),
  handleAddItem: vi.fn(),
  handleAddSection: vi.fn(),
  handleAppendedSections: vi.fn(),
  handleAddStage: vi.fn(),
  handleAppendedCatalogueItems: vi.fn(),
  rows: [],
} as unknown as EditorContextT

const renderToolbar = (assets?: MediaFileT[]) =>
  render(
    <KosztorysEditorProvider editor={editorContext}>
      {/* „Dodaj" reaches for the catalogue picker, which the editor body hosts above the toolbar. */}
      <CataloguePickerHost>
        <KosztorysEditorToolbar investmentId={7} assets={assets} />
      </CataloguePickerHost>
    </KosztorysEditorProvider>,
  )

const galleryTrigger = () => screen.queryByRole('button', { name: /^Podgląd plików inwestycji/ })
const addTrigger = () => screen.queryByRole('button', { name: 'Dodaj zdjęcia lub pliki' })

describe('KosztorysEditorToolbar — bramka galerii assetów', () => {
  it('shows the investment gallery when the surface carries assets', () => {
    renderToolbar([PHOTO])

    expect(galleryTrigger()).toBeInTheDocument()
  })

  it('offers the picker when the investment has no files yet', () => {
    renderToolbar([])

    expect(addTrigger()).toBeInTheDocument()
  })

  // The szablon workbench and both share surfaces pass no `assets` at all. Rendering a gallery there
  // would expose the files of whichever investment the szablon was cut from.
  it('renders no gallery at all on a surface that carries none', () => {
    renderToolbar(undefined)

    expect(galleryTrigger()).not.toBeInTheDocument()
    expect(addTrigger()).not.toBeInTheDocument()
  })
})
