import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { CleanItemTextsMenuItem } from '@/components/kosztorys/editor/actions/clean-item-texts-action'

const toastMessage = vi.hoisted(() => vi.fn())
const cleanItemTextsAction = vi.hoisted(() => vi.fn())
const onTreeReplaced = vi.hoisted(() => vi.fn())

vi.mock('@/lib/utils/toast', () => ({ toastMessage }))
vi.mock('@/lib/actions/kosztorys', () => ({ cleanItemTextsAction }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({ investmentId: 7, onTreeReplaced }),
}))

function renderItem() {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <CleanItemTextsMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return screen.getByRole('menuitem', { name: /Popraw literówki/ })
}

describe('CleanItemTextsMenuItem', () => {
  beforeEach(() => vi.clearAllMocks())

  it('an interrupted request re-enables the item, says so and refetches the tree', async () => {
    cleanItemTextsAction.mockRejectedValue(new TypeError('Failed to fetch'))
    const item = renderItem()

    await userEvent.click(item)

    await vi.waitFor(() => expect(item).not.toHaveAttribute('data-disabled'))
    expect(toastMessage).toHaveBeenCalledWith(expect.stringContaining('Nie udało się'), 'error')
    expect(onTreeReplaced).toHaveBeenCalledWith({ refetch: true })
  })
})
