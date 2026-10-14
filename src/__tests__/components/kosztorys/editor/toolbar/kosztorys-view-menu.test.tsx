import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'

// The workbench keeps the menu down to its column list, so the text-size block is the only other
// radio group on screen.
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    view: 'client',
    moneyAxis: 'net',
    setMoneyAxis: vi.fn(),
    layer: 'both',
    setLayer: vi.fn(),
    crewAxis: 'none',
    setCrewAxis: vi.fn(),
    columnToggleItems: [{ id: 'unit', label: 'J.m.', visible: true }],
    revealedColumnIds: new Set<string>(),
    toggleColumn: vi.fn(),
    setAllColumns: vi.fn(),
    columnRanks: {},
    columnBaseRanks: {},
    setColumnRank: vi.fn(),
    resetColumnOrder: vi.fn(),
    offerAvailable: false,
    offer: false,
    setOffer: vi.fn(),
    isTemplate: true,
    stages: [],
    isStageOff: () => false,
    engagedStageConditionIds: new Set<string>(),
  }),
}))

const openMenu = async () => {
  render(<KosztorysViewMenu />)
  await userEvent.click(screen.getByRole('button', { name: /^Kolumny/ }))
}

describe('KosztorysViewMenu — wielkość czcionki', () => {
  beforeEach(() => window.localStorage.clear())

  // No „Duża”: the grid's line is fixed at the default's height, so anything larger would clip.
  it('offers the three sizes the grid can hold, „Średnia” by default', async () => {
    await openMenu()

    const sizes = screen.getAllByRole('menuitemradio')
    expect(sizes.map((item) => item.textContent)).toEqual(['Bardzo mała', 'Mała', 'Średnia'])
    expect(screen.getByRole('menuitemradio', { name: 'Średnia' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('remembers the pick and stays open for the grid behind to show it', async () => {
    await openMenu()

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Mała' }))

    expect(screen.getByRole('menuitemradio', { name: 'Mała' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(window.localStorage.getItem('kosztorys-text-size')).toBe('xs')
  })
})
