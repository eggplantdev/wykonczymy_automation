import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysRowActionsMenu } from '@/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

const ROW = { id: 41, sectionId: 3 } as KosztorysV2RowT
const ITEM = {
  onInsertAbove: vi.fn(),
  onInsertBelow: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
  onRemove: vi.fn(),
}

async function openRowMenu(sortActive: boolean) {
  const user = userEvent.setup()
  render(
    <KosztorysRowActionsMenu row={ROW} sortActive={sortActive} canMoveUp canMoveDown item={ITEM} />,
  )
  await user.click(screen.getByRole('button', { name: 'Akcje wiersza' }))
  return user
}

beforeEach(() => vi.clearAllMocks())

const POSITIONAL = ['Wstaw powyżej', 'Wstaw poniżej', 'Przesuń w górę', 'Przesuń w dół']

// Against a sorted view the array position no longer mirrors display_order, so every positional
// command goes dead while any sort is on, whatever its scope.
describe('menu wiersza — komendy pozycyjne przy aktywnym sortowaniu', () => {
  it('wyszarza wstawianie i przesuwanie', async () => {
    await openRowMenu(true)

    for (const label of POSITIONAL) {
      expect(screen.getByRole('menuitem', { name: label })).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('oddaje je, gdy sortowania nie ma', async () => {
    const user = await openRowMenu(false)

    for (const label of POSITIONAL) {
      expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute('aria-disabled')
    }
    await user.click(screen.getByRole('menuitem', { name: 'Przesuń w górę' }))
    expect(ITEM.onMoveUp).toHaveBeenCalled()
  })
})
