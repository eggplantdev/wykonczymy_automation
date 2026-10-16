import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'

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
    // at 'none' there would be nothing plane-bound left for a sweep to reach.
    crewAxis: 'both',
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

  it('leaves a filter with no matches off the list and out of the sweep', async () => {
    renderMenu({ 'has-note': 4, 'no-note': 0 })
    await openMenu()

    expect(screen.queryByRole('option', { name: /bez komentarza/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(sweptIds()).toEqual(['has-note'])
  })

  it('does reach an engaged filter its last match has left', async () => {
    renderMenu({ 'manual-rate-w-tools': 0 }, ['manual-rate-w-tools'])
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Zaznacz wszystkie' }))

    expect(editorState.setConditions).toHaveBeenCalledWith(expect.any(Array), false)
    expect(sweptIds()).toEqual(['manual-rate-w-tools'])
  })
})

describe('KosztorysFiltersMenu — nagłówki kategorii', () => {
  it('files each row under the axis it asks about', async () => {
    renderMenu({ 'has-planned-qty': 4, 'manual-rate-w-tools': 2, 'has-note': 1 })
    await openMenu()

    expect(screen.getByRole('group', { name: 'Źródło stawki wykonawcy' })).toHaveTextContent(
      'Kwota stała — z narzędziami (podwykonawca) (2)',
    )
    expect(screen.getByRole('group', { name: 'Przedmiar i wykonana praca' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Komentarz' })).toBeInTheDocument()
  })

  it('keeps the sweep out of every axis it sweeps', async () => {
    renderMenu({ 'has-planned-qty': 4, 'has-note': 1 })
    await openMenu()

    expect(screen.getByRole('group', { name: 'Przedmiar i wykonana praca' })).not.toHaveTextContent(
      'Odznacz wszystkie',
    )
  })
})

describe('KosztorysFiltersMenu — nothing to offer', () => {
  it('renders no trigger', () => {
    renderMenu({})

    expect(screen.queryByRole('button', { name: /^Filtry/ })).not.toBeInTheDocument()
  })
})
