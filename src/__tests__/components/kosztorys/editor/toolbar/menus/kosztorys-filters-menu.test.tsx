import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'

// The bulk row is the only control in the menu that acts on more than one filter, so what it acts ON
// is the whole risk: a sweep is undone one tick at a time, and a filter it engaged without a row on
// screen would hide pozycje the user has no control to bring back.

const editorState = vi.hoisted(() => ({
  engagedConditionIds: new Set<string>(),
  conditionCounts: new Map<string, number>(),
  setConditions: vi.fn(),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    engagedConditionIds: editorState.engagedConditionIds,
    conditionCounts: editorState.conditionCounts,
    toggleCondition: vi.fn(),
    setConditions: editorState.setConditions,
    resetFilters: vi.fn(),
    collapsedSectionIds: new Set<number>(),
    globalDiscount: { type: null, value: 0 },
    search: '',
  }),
}))

function renderMenu(counts: Record<string, number>, engaged: string[] = []) {
  editorState.conditionCounts = new Map(Object.entries(counts))
  editorState.engagedConditionIds = new Set(engaged)
  editorState.setConditions.mockClear()
  render(<KosztorysFiltersMenu />)
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /^Filtry/ }))

const sweptIds = (): string[] => editorState.setConditions.mock.calls[0][0]

describe('KosztorysFiltersMenu — wiersz zbiorczy', () => {
  it('hides every filter the menu is offering, in one write', async () => {
    renderMenu({ 'no-planned-qty': 3, 'own-rate-over-ceiling-w-tools': 2 })
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(editorState.setConditions).toHaveBeenCalledTimes(1)
    // `true` is engaged, and an engaged filter REMOVES its matches — „odznacz" reads as hiding.
    expect(editorState.setConditions).toHaveBeenCalledWith(expect.any(Array), true)
    expect(sweptIds()).toEqual(['no-planned-qty', 'own-rate-over-ceiling-w-tools'])
  })

  // The counter on the trigger is the only thing left saying so once the panel is closed, and
  // „Zresetuj filtry" is the way back — a sweep with neither would be a grid that went blank.
  it('lights the trigger counter and leaves the reset reachable', async () => {
    const engaged = ['no-planned-qty', 'has-planned-qty', 'has-note']
    renderMenu({ 'no-planned-qty': 3, 'has-planned-qty': 4, 'has-note': 1 }, engaged)

    expect(screen.getByRole('button', { name: `Filtry (${engaged.length})` })).toBeInTheDocument()

    await openMenu()

    expect(screen.getByRole('button', { name: 'Zresetuj filtry' })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'Zaznacz wszystkie' })).toBeInTheDocument()
  })

  it('sweeps both planes’ stawka filters, whichever view the grid is on', async () => {
    renderMenu({ 'manual-rate-w-tools': 2, 'manual-rate-own-tools': 5 })
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(sweptIds()).toEqual(['manual-rate-w-tools', 'manual-rate-own-tools'])
  })

  // What bounds the sweep now is the count, not the plane: a zawężenie with nothing to hide has no
  // row in the menu, so engaging it would remove no pozycja and only pull that plane's price columns
  // onto the screen — with no tick to undo it from.
  it('leaves a filter with no matches off the list and out of the sweep', async () => {
    renderMenu({ 'has-note': 4, 'no-note': 0 })
    await openMenu()

    expect(screen.queryByRole('option', { name: /bez komentarza/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(sweptIds()).toEqual(['has-note'])
  })

  // An engaged filter stays listed at „(0)" so it can be released, so the sweep has to reach it — it
  // is on screen.
  it('does reach an engaged filter its last match has left', async () => {
    renderMenu({ 'manual-rate-w-tools': 0 }, ['manual-rate-w-tools'])
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Zaznacz wszystkie' }))

    expect(editorState.setConditions).toHaveBeenCalledWith(expect.any(Array), false)
    expect(sweptIds()).toEqual(['manual-rate-w-tools'])
  })
})

describe('KosztorysFiltersMenu — nagłówki kategorii', () => {
  // Sixteen rows with no headings read as one undifferentiated list, and the two stawka axes are the
  // pair a reader most needs told apart.
  it('files each row under the axis it asks about', async () => {
    renderMenu({ 'has-planned-qty': 4, 'manual-rate-w-tools': 2, 'has-note': 1 })
    await openMenu()

    expect(screen.getByRole('group', { name: 'Źródło stawki wykonawcy' })).toHaveTextContent(
      'Pozycje ze stawką wykonawcy z kwoty stałej w widoku z narzędziami (podwykonawca) (2)',
    )
    expect(screen.getByRole('group', { name: 'Przedmiar i wykonana praca' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Komentarz' })).toBeInTheDocument()
  })

  // Inside the first heading the sweep would read as acting on that axis alone.
  it('keeps the sweep out of every axis it sweeps', async () => {
    renderMenu({ 'has-planned-qty': 4, 'has-note': 1 })
    await openMenu()

    expect(screen.getByRole('group', { name: 'Przedmiar i wykonana praca' })).not.toHaveTextContent(
      'Odznacz wszystkie',
    )
  })
})
