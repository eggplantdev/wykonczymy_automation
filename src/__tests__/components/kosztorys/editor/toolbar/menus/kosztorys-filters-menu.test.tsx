import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

const editorState = vi.hoisted(() => ({
  engagedConditionIds: new Set<string>(),
  conditionCounts: new Map<string, number>(),
  toggleCondition: vi.fn(),
  setConditions: vi.fn(),
}))

vi.mocked(useKosztorysEditorContext).mockImplementation(
  () =>
    ({
      engagedConditionIds: editorState.engagedConditionIds,
      conditionCounts: editorState.conditionCounts,
      toggleCondition: editorState.toggleCondition,
      setConditions: editorState.setConditions,
      rows: Array.from({ length: 10 }),
      resetFilters: vi.fn(),
      collapsedSectionIds: new Set<number>(),
      globalDiscount: { type: null, value: 0 },
      crewAxis: 'both',
      search: '',
    }) as never,
)

function renderMenu(counts: Record<string, number>, engaged: string[] = []) {
  editorState.conditionCounts = new Map(Object.entries(counts))
  editorState.engagedConditionIds = new Set(engaged)
  editorState.toggleCondition.mockClear()
  editorState.setConditions.mockClear()
  render(<KosztorysFiltersMenu />)
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /^Filtry/ }))

describe('KosztorysFiltersMenu — tick what you want to see', () => {
  it('opens with nothing ticked', async () => {
    renderMenu({ 'has-discount': 4, 'no-discount': 6 })
    expect(screen.getByRole('button', { name: 'Filtry' })).toBeInTheDocument()
    await openMenu()
  })

  it('engages the filter a tick names', async () => {
    renderMenu({ 'has-discount': 4, 'no-discount': 6 })
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Z rabatem (4)' }))

    expect(editorState.toggleCondition).toHaveBeenCalledWith('has-discount')
  })

  it('counts the ticks on the trigger; „Wyczyść" unticks only this menu’s options', async () => {
    const engaged = ['has-planned-qty', 'has-discount']
    renderMenu({ 'no-planned-qty': 3, 'has-planned-qty': 4, 'has-discount': 1 }, engaged)

    expect(screen.getByRole('button', { name: `Filtry (${engaged.length})` })).toBeInTheDocument()

    await openMenu()

    expect(screen.queryByRole('button', { name: 'Wyczyść filtry' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'Wyczyść' }))
    const [ids, engage] = editorState.setConditions.mock.calls[0]
    expect(engage).toBe(false)
    expect(ids).toEqual(expect.arrayContaining(engaged))
  })

  it('offers „Wyczyść" only once something is ticked', async () => {
    renderMenu({ 'has-discount': 4, 'no-discount': 6 })
    await openMenu()
    expect(screen.queryByRole('option', { name: 'Wyczyść' })).not.toBeInTheDocument()
  })

  it('leaves a filter with no matches off the list', async () => {
    renderMenu({ 'has-discount': 4, 'no-discount': 0 })
    await openMenu()

    expect(screen.queryByRole('option', { name: /bez rabatu/i })).not.toBeInTheDocument()
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
      'has-discount': 1,
    })
    await openMenu()

    expect(
      screen.getByRole('group', { name: 'Źródło stawki wykonawcy — z narzędziami (podwykonawca)' }),
    ).toHaveTextContent('Kwota stała (2)')
    expect(
      screen.getByRole('group', { name: 'Źródło stawki wykonawcy — bez narzędzi (pracownik)' }),
    ).toHaveTextContent('Kwota stała (3)')
    expect(screen.getByRole('group', { name: 'Przedmiar' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Rabat' })).toBeInTheDocument()
  })
})

describe('KosztorysFiltersMenu — nothing to offer', () => {
  it('renders no trigger', () => {
    renderMenu({})

    expect(screen.queryByRole('button', { name: /^Filtry/ })).not.toBeInTheDocument()
  })
})
