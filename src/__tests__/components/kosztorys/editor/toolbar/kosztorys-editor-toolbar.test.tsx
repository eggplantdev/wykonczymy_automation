import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { CataloguePickerHost } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { ReorderHost } from '@/components/kosztorys/editor/actions/reorder-host'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { CurrentUserProvider } from '@/hooks/use-current-user'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

type EditorContextT = Parameters<typeof KosztorysEditorProvider>[0]['editor']

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
  isTemplate: false,
  noun: { accusative: 'kosztorys' },
  hasSheet: false,
  globalDiscount: { type: null, value: 0 },
  engagedConditionIds: new Set<string>(),
  engagedStageConditionIds: new Set<string>(),
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
  sections: [],
  stages: [],
  workers: [],
} as unknown as EditorContextT

// „Udostępnij inwestorowi" reads the session's role, and the toolbar mounts that dialog on the way to
// first paint — so without a session the whole toolbar throws.
const sessionUser = {
  id: 1,
  email: 'owner@example.test',
  name: 'Testowy Właściciel',
  role: 'OWNER',
} as const

const renderToolbar = (overrides: Partial<Record<string, unknown>> = {}) =>
  render(
    <CurrentUserProvider user={sessionUser}>
      <KosztorysEditorProvider editor={{ ...editorContext, ...overrides } as EditorContextT}>
        <CataloguePickerHost>
          <ReorderHost>
            <KosztorysEditorToolbar />
          </ReorderHost>
        </CataloguePickerHost>
      </KosztorysEditorProvider>
    </CurrentUserProvider>,
  )

describe('KosztorysEditorToolbar — przełącznik panelu', () => {
  it('stays clickable with no rows at all', () => {
    renderToolbar()

    expect(screen.getByRole('button', { name: /Podsumowanie/ })).not.toBeDisabled()
  })

  it('is absent on the szablon workbench', () => {
    renderToolbar({ isTemplate: true })

    expect(screen.queryByRole('button', { name: /Podsumowanie/ })).not.toBeInTheDocument()
  })
})

describe('KosztorysEditorToolbar — „Widok cen"', () => {
  it('offers the plane switch on an investment', () => {
    renderToolbar()

    expect(screen.getByRole('group', { name: 'Widok cen' })).toBeInTheDocument()
  })

  it('drops it on the szablon workbench', () => {
    renderToolbar({ isTemplate: true })

    expect(screen.queryByRole('group', { name: 'Widok cen' })).not.toBeInTheDocument()
  })
})

describe('KosztorysEditorToolbar — „Kolumny"', () => {
  it('offers the column picker on the szablon workbench', () => {
    renderToolbar({
      isTemplate: true,
      columnToggleItems: [{ id: 'description', label: 'Opis prac', visible: true }],
    })

    expect(screen.getByRole('button', { name: /Kolumny/ })).toBeInTheDocument()
  })
})
