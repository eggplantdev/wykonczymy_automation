import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { editorNoun } from '@/lib/kosztorys/editor-noun'

// The szablon workbench renders THE SAME editor as an investment, so every label under „Opcje"
// talks about a „kosztorys" until someone asks it which screen it is on. The assertions read what
// is visible once the menu opens — the noun table can be right while the component never reads it.

const editorState = vi.hoisted(() => ({ templatePresetId: undefined as number | undefined }))

// The dialogs hang beside the menu as siblings (see KosztorysActionsProvider), so they render
// together with it — and one of them reaches for the Next router, which jsdom does not have.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 1,
    investmentName: 'Testowa',
    tree: { sections: [] },
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
    templatePresetId: editorState.templatePresetId,
    // Derived exactly as KosztorysEditorBody derives it, so the spec still drives the whole menu
    // off the one input the screen has — which szablon the workbench holds.
    isWorkshop: editorState.templatePresetId != null,
    noun: editorNoun(editorState.templatePresetId),
  }),
}))

function renderToolbar(templatePresetId: number | undefined) {
  editorState.templatePresetId = templatePresetId
  render(
    <KosztorysActionsProvider>
      <KosztorysActionsMenu />
    </KosztorysActionsProvider>,
  )
}

// An open Radix menu is modal — it hides the rest of the toolbar from `getByRole` behind
// `aria-hidden`, so the „Inwestor" button is asked about before opening it, not after.
const openOptions = () => userEvent.click(screen.getByRole('button', { name: 'Opcje' }))

describe('KosztorysActionsMenu', () => {
  it('na inwestycji zostaje przy kosztorysie i przy inwestorze', async () => {
    renderToolbar(undefined)

    expect(screen.getByRole('button', { name: 'Inwestor' })).toBeInTheDocument()

    await openOptions()

    expect(screen.getByRole('menuitem', { name: /Wyczyść kosztorys…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Wczytaj szablon…/ })).toBeInTheDocument()
  })

  // A szablon has no investor, so the preview through their eyes and the share link have nobody
  // to address.
  it('w warsztacie nie oferuje inwestora', () => {
    renderToolbar(7)

    expect(screen.queryByRole('button', { name: 'Inwestor' })).not.toBeInTheDocument()
  })

  it('w warsztacie mówi „szablon”, nie „kosztorys”', async () => {
    renderToolbar(7)
    await openOptions()

    expect(screen.getByRole('menuitem', { name: /Wyczyść szablon…/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Przełącz na inny szablon…/ })).toBeInTheDocument()
    expect(screen.getByRole('menu')).not.toHaveTextContent(/kosztorys/i)
  })
})
