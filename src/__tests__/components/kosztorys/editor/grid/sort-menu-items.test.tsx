import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { SortMenuItems } from '@/components/kosztorys/editor/grid/sort-menu-items'
import type { SortPickT } from '@/lib/kosztorys/row-view'

const onSort = vi.fn()
const onPersistOrder = vi.fn()

// The menu items live inside a Radix menu, so they need one open around them — the header's trigger
// is not what is under test here.
function renderSortMenu(active: SortPickT | null = null, persist?: () => void) {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <SortMenuItems active={active} onSort={onSort} onPersistOrder={persist} />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return userEvent.setup()
}

beforeEach(() => vi.clearAllMocks())

describe('menu kolumny — cztery komendy sortowania', () => {
  // Direction and scope are picked in ONE gesture, so no scope can be in force unnoticed. That is
  // what these four commands are for, and dropping one would silently reintroduce a hidden toggle.
  it.each([
    ['Sortuj rosnąco zachowując sekcje', { dir: 'asc', scope: 'section' }],
    ['Sortuj malejąco zachowując sekcje', { dir: 'desc', scope: 'section' }],
    ['Sortuj rosnąco', { dir: 'asc', scope: 'global' }],
    ['Sortuj malejąco', { dir: 'desc', scope: 'global' }],
  ])('„%s" zamawia dokładnie swój kierunek i zakres', async (label, pick) => {
    const user = renderSortMenu()

    await user.click(screen.getByRole('menuitem', { name: label }))

    expect(onSort).toHaveBeenCalledWith(pick)
  })

  it('oferuje „Zapisz kolejność" przy każdym zakresie, także globalnym', async () => {
    const user = renderSortMenu({ dir: 'asc', scope: 'global' }, onPersistOrder)

    await user.click(screen.getByRole('menuitem', { name: 'Zapisz kolejność' }))

    expect(onPersistOrder).toHaveBeenCalled()
  })

  it('nie pokazuje „Zapisz kolejność" tam, gdzie nikt nie może pisać', () => {
    renderSortMenu()

    expect(screen.queryByRole('menuitem', { name: 'Zapisz kolejność' })).toBeNull()
  })

  it('„Wyczyść sortowanie" jest martwe, dopóki nie ma czego czyścić', () => {
    renderSortMenu()

    expect(screen.getByRole('menuitem', { name: 'Wyczyść sortowanie' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('„Wyczyść sortowanie" zdejmuje aktywne sortowanie', async () => {
    const user = renderSortMenu({ dir: 'desc', scope: 'section' })

    await user.click(screen.getByRole('menuitem', { name: 'Wyczyść sortowanie' }))

    expect(onSort).toHaveBeenCalledWith(null)
  })
})
