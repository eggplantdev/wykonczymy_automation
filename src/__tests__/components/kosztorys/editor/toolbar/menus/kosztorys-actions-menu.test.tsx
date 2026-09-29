import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { editorNoun } from '@/lib/kosztorys/editor-noun'
import { CurrentUserProvider } from '@/hooks/use-current-user'

// The szablon workbench renders THE SAME editor as an investment, so every label under „Opcje"
// talks about a „kosztorys" until someone asks it which screen it is on. The assertions read what
// is visible once the menu opens — the noun table can be right while the component never reads it.

const editorState = vi.hoisted(() => ({ isTemplate: false }))

// The dialogs hang beside the menu as siblings (see KosztorysActionsProvider), so they render
// together with it — and one of them reaches for the Next router, which jsdom does not have.

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 1,
    investmentName: 'Testowa',
    tree: { sections: [] },
    stages: [],
    workers: [],
    hasSheet: false,
    readOnly: false,
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    fitRowsToContent: false,
    toggleFitRowsToContent: vi.fn(),
    onOpenVersions: vi.fn(),
    openImport: vi.fn(),
    catalogueComparison: null,
    workCatalogue: [],
    handleApplyCatalogueToItems: vi.fn(),
    handleAcceptCatalogueName: vi.fn(),
    engagedConditionIds: new Set<string>(),
    toggleConditionExclusive: vi.fn(),
    // Derived exactly as KosztorysEditorBody derives it, so the spec still drives the whole menu
    // off the one input the screen has.
    isTemplate: editorState.isTemplate,
    noun: editorNoun(editorState.isTemplate),
  }),
}))

function renderToolbar(isTemplate: boolean) {
  editorState.isTemplate = isTemplate
  render(
    <CurrentUserProvider user={{ id: 1, email: 'm@t.com', name: 'Manager', role: 'MANAGER' }}>
      <KosztorysActionsProvider>
        <KosztorysActionsMenu />
      </KosztorysActionsProvider>
    </CurrentUserProvider>,
  )
}

// An open Radix menu is modal — it hides the rest of the toolbar from `getByRole` behind
// `aria-hidden`, so the „Inwestor" button is asked about before opening it, not after.
const openOptions = () => userEvent.click(screen.getByRole('button', { name: 'Opcje' }))

describe('KosztorysActionsMenu', () => {
  it('na inwestycji zostaje przy kosztorysie i przy inwestorze', async () => {
    renderToolbar(false)

    expect(screen.getByRole('button', { name: 'Inwestor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pracownicy' })).toBeInTheDocument()

    await openOptions()

    expect(screen.getByRole('menuitem', { name: /Wyczyść kosztorys…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Wczytaj szablon…/ })).toBeInTheDocument()
  })

  // A szablon has no investor and no crew on its etapy, so the previews through their eyes and the
  // share links have nobody to address.
  it('na szablonie nie oferuje inwestora ani pracowników', () => {
    renderToolbar(true)

    expect(screen.queryByRole('button', { name: 'Inwestor' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pracownicy' })).not.toBeInTheDocument()
  })

  it('na szablonie mówi „szablon”, nie „kosztorys”', async () => {
    renderToolbar(true)
    await openOptions()

    expect(screen.getByRole('menuitem', { name: /Wyczyść szablon…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Wczytaj szablon…/ })).toBeInTheDocument()
    expect(screen.getByRole('menu')).not.toHaveTextContent(/kosztorys/i)
  })
})
