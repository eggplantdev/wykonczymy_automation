import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysSectionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-sections-menu'

const editorState = vi.hoisted(() => ({
  storedCollapsedSectionIds: new Set<number>(),
  setCollapsedSectionIds: vi.fn(),
}))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    subtotals: [
      { sectionId: 1, sectionName: 'Łazienka' },
      { sectionId: 2, sectionName: 'Kuchnia' },
    ],
    collapsedSectionIds: editorState.storedCollapsedSectionIds,
    storedCollapsedSectionIds: editorState.storedCollapsedSectionIds,
    setCollapsedSectionIds: editorState.setCollapsedSectionIds,
    foldableSectionIds: new Map(),
    engagedConditionIds: new Set<string>(),
    globalDiscount: { type: null, value: 0 },
    crewAxis: 'both',
    isTemplate: false,
    search: '',
    resetFilters: vi.fn(),
  }),
}))

beforeEach(() => editorState.setCollapsedSectionIds.mockClear())

// The selection is debounced and flushed when the panel closes.
async function pick(collapsed: number[], label: string) {
  editorState.storedCollapsedSectionIds = new Set(collapsed)
  render(<KosztorysSectionsMenu />)
  await userEvent.click(screen.getByRole('button', { name: /^Sekcje/ }))
  await userEvent.click(screen.getByRole('option', { name: label }))
  await userEvent.keyboard('{Escape}')
}

const collapsedTo = () => [...editorState.setCollapsedSectionIds.mock.lastCall![0]].sort()

describe('KosztorysSectionsMenu — ticked = expanded', () => {
  it('folds the sekcja whose tick comes off', async () => {
    await pick([], 'Kuchnia')
    expect(collapsedTo()).toEqual([2])
  })

  it('„Zwiń wszystkie sekcje" folds every sekcja', async () => {
    await pick([], 'Zwiń wszystkie sekcje')
    expect(collapsedTo()).toEqual([1, 2])
  })

  it('„Rozwiń wszystkie sekcje" opens every sekcja once all are folded', async () => {
    await pick([1, 2], 'Rozwiń wszystkie sekcje')
    expect(collapsedTo()).toEqual([])
  })

  it('opens the one sekcja ticked while all are folded', async () => {
    await pick([1, 2], 'Łazienka')
    expect(collapsedTo()).toEqual([2])
  })
})
