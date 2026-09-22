import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// The bulk row is the only control in the menu that acts on more than one filter, so what it acts ON
// is the whole risk: a sweep is undone one tick at a time, and a filter it engaged in a view the menu
// was not listing would hide pozycje from a row the user never saw.

const editorState = vi.hoisted(() => ({
  view: 'client' as PriceViewT,
  engagedConditionIds: new Set<string>(),
  setConditions: vi.fn(),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    view: editorState.view,
    engagedConditionIds: editorState.engagedConditionIds,
    conditionCounts: new Map<string, number>(),
    toggleCondition: vi.fn(),
    setConditions: editorState.setConditions,
    resetFilters: vi.fn(),
    collapsedSectionIds: new Set<number>(),
    globalDiscount: { type: null, value: 0 },
    search: '',
  }),
}))

function renderMenu(view: PriceViewT, engaged: string[] = []) {
  editorState.view = view
  editorState.engagedConditionIds = new Set(engaged)
  editorState.setConditions.mockClear()
  render(<KosztorysFiltersMenu />)
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: /^Filtry/ }))

const sweptIds = (): string[] => editorState.setConditions.mock.calls[0][0]

describe('KosztorysFiltersMenu — wiersz zbiorczy', () => {
  it('hides every filter the menu is offering, in one write', async () => {
    renderMenu('w_tools')
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(editorState.setConditions).toHaveBeenCalledTimes(1)
    // `true` is engaged, and an engaged filter REMOVES its matches — „odznacz" reads as hiding.
    expect(editorState.setConditions).toHaveBeenCalledWith(expect.any(Array), true)
    expect(sweptIds()).toContain('no-planned-qty')
    expect(sweptIds()).toContain('fixed-rate-over-ceiling-w-tools')
  })

  // The counter on the trigger is the only thing left saying so once the panel is closed, and
  // „Zresetuj filtry" is the way back — a sweep with neither would be a grid that went blank.
  it('lights the trigger counter and leaves the reset reachable', async () => {
    const engaged = ['no-planned-qty', 'has-planned-qty', 'has-note']
    renderMenu('client', engaged)

    expect(screen.getByRole('button', { name: `Filtry (${engaged.length})` })).toBeInTheDocument()

    await openMenu()

    expect(screen.getByRole('button', { name: 'Zresetuj filtry' })).not.toBeDisabled()
    expect(screen.getByRole('option', { name: 'Zaznacz wszystkie' })).toBeInTheDocument()
  })

  it('leaves the other plane’s filters alone, since the menu never listed them', async () => {
    renderMenu('client')
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Odznacz wszystkie' }))

    expect(sweptIds()).toContain('no-planned-qty')
    expect(sweptIds().filter((id) => id.endsWith('-w-tools') || id.endsWith('-own-tools'))).toEqual(
      [],
    )
  })

  // An id engaged from the other plane stays offered (offeredFilterConditions keeps it visible so it
  // can be untangled), so the sweep has to reach it — it is on screen.
  it('does reach a filter engaged from elsewhere, because that one IS on screen', async () => {
    renderMenu('client', ['manual-rate-w-tools'])
    await openMenu()

    await userEvent.click(screen.getByRole('option', { name: 'Zaznacz wszystkie' }))

    expect(editorState.setConditions).toHaveBeenCalledWith(expect.any(Array), false)
    expect(sweptIds()).toContain('manual-rate-w-tools')
  })
})
