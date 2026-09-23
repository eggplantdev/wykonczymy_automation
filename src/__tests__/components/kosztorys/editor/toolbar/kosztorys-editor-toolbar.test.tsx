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

const renderToolbar = (overrides: Partial<Record<string, unknown>> = {}) =>
  render(
    <KosztorysEditorProvider editor={{ ...editorContext, ...overrides } as EditorContextT}>
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

describe('KosztorysEditorToolbar — „Widok cen"', () => {
  it('offers the plane switch on an investment', () => {
    renderToolbar()

    expect(screen.getByRole('group', { name: 'Widok cen' })).toBeInTheDocument()
  })

  // The workbench renders a closed column list, so both crews' stawki are on screen at once and the
  // switch moves no column — it only moves the „Cena j.m." sort key and which filters are counted,
  // neither of which the owner came to the szablon to change. Its plane is pinned instead, which is
  // what makes dropping the control safe: `pickView` is the only writer of the stored view.
  it('drops it on the szablon workbench', () => {
    renderToolbar({ isWorkshop: true })

    expect(screen.queryByRole('group', { name: 'Widok cen' })).not.toBeInTheDocument()
  })
})
