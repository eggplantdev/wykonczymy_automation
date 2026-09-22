import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { CataloguePickerHost } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

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

const renderToolbar = () =>
  render(
    <KosztorysEditorProvider editor={editorContext}>
      {/* „Dodaj" reaches for the catalogue picker, which the editor body hosts above the toolbar. */}
      <CataloguePickerHost>
        <KosztorysEditorToolbar />
      </CataloguePickerHost>
    </KosztorysEditorProvider>,
  )

describe('KosztorysEditorToolbar — przełącznik panelu', () => {
  // The panel carries „Inwestycja", so an empty kosztorys has something to open — a disabled toggle
  // would put Dokumentacja out of reach on exactly a fresh investment.
  it('stays clickable with no rows at all', () => {
    renderToolbar()

    expect(screen.getByRole('button', { name: /Podsumowanie/ })).not.toBeDisabled()
  })
})
