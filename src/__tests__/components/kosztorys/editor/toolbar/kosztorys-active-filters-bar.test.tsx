import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysActiveFiltersBar } from '@/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_CONDITIONS, PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: vi.fn(),
}))

const FILTER_ID = 'has-discount'
const PROBLEM_ID = PROBLEM_CONDITIONS[0]!.id

const handlers = {
  toggleCondition: vi.fn(),
  toggleConditionExclusive: vi.fn(),
  setCollapsedSectionIds: vi.fn(),
  setSearch: vi.fn(),
  resetFilters: vi.fn(),
}

// The bar reads the editor context directly, so the spec supplies it directly — mounting the real
// editor to reach four handlers would be paying for the grid to render.
function renderBar(state: {
  engagedIds?: string[]
  collapsedSectionIds?: Set<number>
  search?: string
}) {
  vi.mocked(useKosztorysEditorContext).mockReturnValue({
    ...handlers,
    engagedConditionIds: new Set(state.engagedIds ?? []),
    collapsedSectionIds: state.collapsedSectionIds ?? new Set<number>(),
    search: state.search ?? '',
    conditionCounts: new Map([
      [FILTER_ID, 3],
      [PROBLEM_ID, 2],
    ]),
  } as unknown as ReturnType<typeof useKosztorysEditorContext>)

  render(<KosztorysActiveFiltersBar />)
  return userEvent.setup()
}

const removeChip = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  user.click(screen.getByRole('button', { name }))

beforeEach(() => vi.clearAllMocks())

// Four sources narrow the rozpiska and each hides pozycje differently. A bar that knows three of
// them says „nic nie filtruje" over a shorter grid — worse than no bar at all.
describe('Pasek aktywnych filtrów — co stoi na ekranie', () => {
  it('wymienia wszystkie cztery źródła naraz', () => {
    renderBar({
      engagedIds: [FILTER_ID, PROBLEM_ID],
      collapsedSectionIds: new Set([1, 2]),
      search: 'kafle',
    })

    expect(screen.getByText(/Ukryto: pozycje z rabatem/)).toBeInTheDocument()
    expect(screen.getByText(/^Tylko:/)).toBeInTheDocument()
    expect(screen.getByText('Zwinięte sekcje')).toBeInTheDocument()
    expect(screen.getByText('Szukaj: „kafle"')).toBeInTheDocument()
  })

  it('znika w całości, gdy nic nie jest włączone', () => {
    renderBar({})

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('nie stawia „Wyczyść wszystko" obok jednego chipa', () => {
    renderBar({ search: 'kafle' })

    // The chip first: „no clear-all button" is equally true of a bar that rendered nothing at all,
    // and that is the failure this test would otherwise report as a pass.
    expect(screen.getByText('Szukaj: „kafle"')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Wyczyść wszystko' })).toBeNull()
  })
})

// The X on a chip has to clear exactly what the chip names — a crossed wiring clears somebody
// else's filter and reads as „pasek sam się przestawia".
describe('Pasek aktywnych filtrów — X zdejmuje swoje źródło', () => {
  it('oddaje filtrowi jego własne przełączenie', async () => {
    const user = renderBar({ engagedIds: [FILTER_ID] })

    await removeChip(user, /Pokaż z powrotem pozycje z rabatem/)

    expect(handlers.toggleCondition).toHaveBeenCalledExactlyOnceWith(FILTER_ID)
  })

  // A problem is cleared through the same exclusive pick it arrived by — that pick also hands back
  // the price plane, so clearing the chip returns to the view the problem took the reader away
  // from.
  it('zdejmuje problem wyborem wyłącznym, nie zwykłym przełączeniem', async () => {
    const user = renderBar({ engagedIds: [PROBLEM_ID] })

    await removeChip(user, /^Przestań pokazywać tylko/)

    expect(handlers.toggleConditionExclusive).toHaveBeenCalledExactlyOnceWith(
      PROBLEM_ID,
      PROBLEM_IDS,
    )
    expect(handlers.toggleCondition).not.toHaveBeenCalled()
  })

  it('rozwija wszystkie sekcje jednym X, nie po jednej', async () => {
    const user = renderBar({ collapsedSectionIds: new Set([1, 2, 3]) })

    expect(screen.getByText('(3)')).toBeInTheDocument()
    await removeChip(user, /Rozwiń wszystkie sekcje/)

    expect(handlers.setCollapsedSectionIds).toHaveBeenCalledOnce()
    expect(vi.mocked(handlers.setCollapsedSectionIds).mock.calls[0]![0]).toEqual(new Set())
  })

  it('czyści frazę', async () => {
    const user = renderBar({ search: 'kafle' })

    await removeChip(user, /Wyczyść wyszukiwanie/)

    expect(handlers.setSearch).toHaveBeenCalledExactlyOnceWith('')
  })

  it('zdejmuje wszystko naraz, łącznie z frazą', async () => {
    const user = renderBar({ engagedIds: [FILTER_ID], search: 'kafle' })

    await user.click(screen.getByRole('button', { name: 'Wyczyść wszystko' }))

    expect(handlers.resetFilters).toHaveBeenCalledOnce()
  })
})
