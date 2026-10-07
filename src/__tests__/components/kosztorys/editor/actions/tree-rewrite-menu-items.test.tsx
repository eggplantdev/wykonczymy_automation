import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { CleanItemTextsMenuItem } from '@/components/kosztorys/editor/actions/clean-item-texts-action'
import { FillTranslationsMenuItem } from '@/components/kosztorys/editor/actions/fill-translations-action'
import { CurrentUserProvider } from '@/hooks/use-current-user'

// Prod 2026-10-06, szablon 166: the translation fill ran 17 s, the closed menu dropped its pending
// flag, and a second click queued a second run behind the first.

const toastMessage = vi.hoisted(() => vi.fn())
const fillKosztorysTranslationsAction = vi.hoisted(() => vi.fn())
const cleanItemTextsAction = vi.hoisted(() => vi.fn())
const onTreeReplaced = vi.hoisted(() => vi.fn())

vi.mock('@/lib/utils/toast', () => ({ toastMessage }))
vi.mock('@/lib/actions/kosztorys-translations', () => ({ fillKosztorysTranslationsAction }))
vi.mock('@/lib/actions/kosztorys', () => ({ cleanItemTextsAction }))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 7,
    onTreeReplaced,
    rows: [{ description: 'Montaż klimatyzacji', descriptionTranslations: {} }],
    stages: [],
    workers: [],
    tree: { sections: [] },
    isTemplate: true,
  }),
}))

function renderMenu() {
  render(
    <CurrentUserProvider user={{ id: 1, email: 'm@t.com', name: 'Manager', role: 'MANAGER' }}>
      <KosztorysActionsProvider>
        <DropdownMenu>
          <DropdownMenuTrigger>Opcje</DropdownMenuTrigger>
          <DropdownMenuContent>
            <CleanItemTextsMenuItem />
            <FillTranslationsMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </KosztorysActionsProvider>
    </CurrentUserProvider>,
  )
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: 'Opcje' }))

describe.each([
  {
    label: /Uzupełnij tłumaczenia/,
    other: /Popraw literówki/,
    action: fillKosztorysTranslationsAction,
    data: { items: 0, sections: 0, failed: 0 },
  },
  {
    label: /Popraw literówki/,
    other: /Uzupełnij tłumaczenia/,
    action: cleanItemTextsAction,
    data: 0,
  },
])('$label', ({ label, other, action, data }) => {
  beforeEach(() => vi.clearAllMocks())

  it('stays disabled across a menu close and reopen while the run is in flight', async () => {
    let finish: (value: unknown) => void = () => {}
    action.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))
    await openMenu()

    expect(screen.getByRole('menuitem', { name: label })).toHaveAttribute('data-disabled')
    await userEvent.click(screen.getByRole('menuitem', { name: label }))

    finish({ success: true, data })
    await vi.waitFor(() =>
      expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute('data-disabled'),
    )
    expect(action).toHaveBeenCalledTimes(1)
  })

  // Both rewrite the same rows, and the second one queues behind the first exactly like a double click.
  it('locks the other tree rewrite while it runs', async () => {
    let finish: (value: unknown) => void = () => {}
    action.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))
    await openMenu()

    expect(screen.getByRole('menuitem', { name: other })).toHaveAttribute('data-disabled')

    finish({ success: true, data })
    await vi.waitFor(() =>
      expect(screen.getByRole('menuitem', { name: other })).not.toHaveAttribute('data-disabled'),
    )
  })

  it('an interrupted request re-enables the item, says so and refetches the tree', async () => {
    action.mockRejectedValue(new TypeError('Failed to fetch'))
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))
    await openMenu()

    await vi.waitFor(() =>
      expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute('data-disabled'),
    )
    expect(toastMessage).toHaveBeenCalledWith(expect.stringContaining('Nie udało się'), 'error')
    expect(onTreeReplaced).toHaveBeenCalledWith({ refetch: true })
  })
})
