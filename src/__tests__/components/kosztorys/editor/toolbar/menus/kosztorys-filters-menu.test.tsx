import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'

const editorState = vi.hoisted(() => ({
  engagedConditionIds: new Set<string>(),
  conditionCounts: new Map<string, number>(),
  toggleCondition: vi.fn(),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    engagedConditionIds: editorState.engagedConditionIds,
    conditionCounts: editorState.conditionCounts,
    toggleCondition: editorState.toggleCondition,
    rows: Array.from({ length: 10 }),
    resetFilters: vi.fn(),
    collapsedSectionIds: new Set<number>(),
    globalDiscount: { type: null, value: 0 },
    crewAxis: 'both',
    search: '',
  }),
}))

function renderMenu(counts: Record<string, number>, engaged: string[] = []) {
  editorState.conditionCounts = new Map(Object.entries(counts))
  editorState.engagedConditionIds = new Set(engaged)
  editorState.toggleCondition.mockClear()
  render(<KosztorysFiltersMenu />)
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /^Filtry/ }))

describe('KosztorysFiltersMenu — tick what you want to see', () => {
  it('opens with nothing ticked and says a tick narrows', async () => {
    renderMenu({ 'has-note': 4, 'no-note': 6 })
    expect(screen.getByRole('button', { name: 'Filtry' })).toBeInTheDocument()
    await openMenu()

    expect(screen.getByText('Pokaż tylko')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /wszystkie/ })).not.toBeInTheDocument()
  })

  it('engages the filter a tick names', async () => {
    renderMenu({ 'has-note': 4, 'no-note': 6 })
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Z komentarzem (4)' }))

    expect(editorState.toggleCondition).toHaveBeenCalledWith('has-note')
  })

  it('counts the ticks on the trigger and leaves the reset reachable', async () => {
    const engaged = ['has-planned-qty', 'has-note']
    renderMenu({ 'no-planned-qty': 3, 'has-planned-qty': 4, 'has-note': 1 }, engaged)

    expect(screen.getByRole('button', { name: `Filtry (${engaged.length})` })).toBeInTheDocument()

    await openMenu()

    expect(screen.getByRole('button', { name: 'Zresetuj filtry' })).not.toBeDisabled()
  })

  it('leaves a filter with no matches off the list', async () => {
    renderMenu({ 'has-note': 4, 'no-note': 0 })
    await openMenu()

    expect(screen.queryByRole('option', { name: /bez komentarza/i })).not.toBeInTheDocument()
  })

  it('keeps an engaged filter its last match has left, so it can be unticked', async () => {
    renderMenu({ 'manual-rate-w-tools': 0 }, ['manual-rate-w-tools'])
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Kwota stała (0)' }))

    expect(editorState.toggleCondition).toHaveBeenCalledWith('manual-rate-w-tools')
  })
})

describe('KosztorysFiltersMenu — nagłówki kategorii', () => {
  it('files each row under the axis it asks about, one heading per plane', async () => {
    renderMenu({
      'has-planned-qty': 4,
      'manual-rate-w-tools': 2,
      'manual-rate-own-tools': 3,
      'has-note': 1,
    })
    await openMenu()

    expect(
      screen.getByRole('group', { name: 'Źródło stawki wykonawcy — z narzędziami (podwykonawca)' }),
    ).toHaveTextContent('Kwota stała (2)')
    expect(
      screen.getByRole('group', { name: 'Źródło stawki wykonawcy — bez narzędzi (pracownik)' }),
    ).toHaveTextContent('Kwota stała (3)')
    expect(screen.getByRole('group', { name: 'Przedmiar' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Komentarz' })).toBeInTheDocument()
  })
})

describe('KosztorysFiltersMenu — nothing to offer', () => {
  it('renders no trigger', () => {
    renderMenu({})

    expect(screen.queryByRole('button', { name: /^Filtry/ })).not.toBeInTheDocument()
  })
})
