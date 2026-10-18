import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, type Mock } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { CleanItemTextsMenuItem } from '@/components/kosztorys/editor/actions/clean-item-texts-action'
import { FillTranslationsMenuItem } from '@/components/kosztorys/editor/actions/fill-translations-action'
import { toastMessage } from '@/lib/utils/toast'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { cleanItemTextsAction } from '@/lib/actions/kosztorys'
import { fillKosztorysTranslationsAction } from '@/lib/actions/kosztorys-translations'

const onTreeReplaced = vi.hoisted(() => vi.fn())
const flushPendingSaves = vi.hoisted(() => vi.fn(async () => {}))

vi.mocked(useKosztorysEditorContext).mockImplementation(
  () =>
    ({
      investmentId: 7,
      onTreeReplaced,
      flushPendingSaves,
      rows: [{ description: 'Montaż klimatyzacji', descriptionTranslations: {} }],
      stages: [],
      workers: [],
      tree: { sections: [] },
      isTemplate: true,
    }) as never,
)

function renderMenu() {
  render(
    <KosztorysActionsProvider>
      <DropdownMenu>
        <DropdownMenuTrigger>Opcje</DropdownMenuTrigger>
        <DropdownMenuContent>
          <CleanItemTextsMenuItem />
          <FillTranslationsMenuItem />
        </DropdownMenuContent>
      </DropdownMenu>
    </KosztorysActionsProvider>,
  )
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: 'Opcje' }))

describe.each([
  {
    label: /Uzupełnij tłumaczenia/,
    other: /Popraw literówki/,
    action: vi.mocked(fillKosztorysTranslationsAction) as Mock,
    data: { items: 0, sections: 0, failed: 0 },
  },
  {
    label: /Popraw literówki/,
    other: /Uzupełnij tłumaczenia/,
    action: vi.mocked(cleanItemTextsAction) as Mock,
    data: 0,
  },
])('$label', ({ label, other, action, data }) => {
  it('runs only after the pending cell saves have settled', async () => {
    const flush = Promise.withResolvers<void>()
    flushPendingSaves.mockReturnValueOnce(flush.promise)
    action.mockResolvedValue({ success: true, data })
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))

    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(action).not.toHaveBeenCalled()

    flush.resolve()
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1))
  })

  it('stays disabled across a menu close and reopen while the run is in flight', async () => {
    const run = Promise.withResolvers()
    action.mockReturnValue(run.promise)
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))
    await openMenu()

    expect(screen.getByRole('menuitem', { name: label })).toHaveAttribute('data-disabled')
    await userEvent.click(screen.getByRole('menuitem', { name: label }))

    run.resolve({ success: true, data })
    await vi.waitFor(() =>
      expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute('data-disabled'),
    )
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('locks the other tree rewrite while it runs', async () => {
    const run = Promise.withResolvers()
    action.mockReturnValue(run.promise)
    renderMenu()

    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: label }))
    await openMenu()

    expect(screen.getByRole('menuitem', { name: other })).toHaveAttribute('data-disabled')

    run.resolve({ success: true, data })
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
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringContaining('Nie udało się'),
      'error',
      6000,
    )
    expect(onTreeReplaced).toHaveBeenCalledWith({ refetch: true })
  })
})
