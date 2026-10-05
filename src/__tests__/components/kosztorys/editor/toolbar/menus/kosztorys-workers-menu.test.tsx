import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { KosztorysWorkersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu'
import { KosztorysWorkerShareDialog } from '@/components/kosztorys/editor/dialogs/share/kosztorys-worker-share-dialog'
import { KosztorysWorkerViewDialog } from '@/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import type { RoleT } from '@/lib/auth/roles'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { WORKER_DOCUMENT_COLUMNS, workerColumnLabel } from '@/lib/kosztorys/worker-view/columns'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'

const INVESTMENT_ID = 12

// Anna holds two etapy (listed once), Bogdan one with no rozliczenie yet (blocked), Celina none.
// Bogdan is inactive: a person deactivated mid-investment still owns their etapy.
const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: 'Etap 1', plane: 'w_tools', split: oneWorkerSplit(10) },
  { id: 2, ordinal: 2, label: 'Etap 2', plane: null, split: oneWorkerSplit(20) },
  { id: 3, ordinal: 3, label: 'Etap 3', plane: 'w_tools', split: oneWorkerSplit(10) },
  { id: 4, ordinal: 4, label: 'Etap 4', plane: 'own_tools', split: null },
]
const ROSTER = [
  { id: 10, name: 'Anna Nowak', active: true },
  { id: 20, name: 'Bogdan Kowal', active: false },
  { id: 30, name: 'Celina Wiśniewska', active: true },
]

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: INVESTMENT_ID,
    investmentName: 'Mieszkanie Mokotów',
    stages: STAGES,
    workers: ROSTER,
  }),
}))

vi.mock('@/lib/queries/worker-view-settings-endpoint', () => ({
  readWorkerViewSettings: vi.fn(async () => ({
    hiddenColumns: [],
    hideEmptyRows: true,
    hidePlannedOnceExecuted: true,
    columnRanks: {},
  })),
}))
vi.mock(
  '@/components/ui/column-order-dialog',
  () => import('@/__tests__/stubs/column-order-dialog'),
)

const readWorkerShareToken = vi.hoisted(() => vi.fn())
const readWorkerShareHolders = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queries/worker-share-link-endpoint', () => ({
  readWorkerShareToken,
  readWorkerShareHolders,
}))
const ensureWorkerLinkAction = vi.hoisted(() => vi.fn())
const revokeWorkerLinkAction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/kosztorys-worker-share', () => ({
  ensureWorkerLinkAction,
  generateWorkerLinkAction: vi.fn(),
  revokeWorkerLinkAction,
}))

const getWorkerKosztorysPrintData = vi.hoisted(() => vi.fn())
vi.mock('@/lib/queries/worker-kosztorys-print-endpoint', () => ({ getWorkerKosztorysPrintData }))

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  ensureWorkerLinkAction.mockResolvedValue({ success: true, data: 'tok-anna' })
  readWorkerShareToken.mockResolvedValue('tok-anna')
  readWorkerShareHolders.mockResolvedValue([])
  revokeWorkerLinkAction.mockResolvedValue({ success: true })
  getWorkerKosztorysPrintData.mockResolvedValue(null)
})

afterEach(() => vi.clearAllMocks())

function renderMenu(role: RoleT = 'MANAGER') {
  render(
    <CurrentUserProvider user={{ id: 1, email: 'm@example.test', name: 'Testowy', role }}>
      <KosztorysActionsProvider>
        <KosztorysWorkersMenu />
        <KosztorysWorkerShareDialog />
        <KosztorysWorkerViewDialog />
      </KosztorysActionsProvider>
    </CurrentUserProvider>,
  )
}

const openMenu = () => userEvent.click(screen.getByRole('button', { name: 'Pracownicy' }))

// Items render in worker order, so the n-th link item belongs to the n-th listed worker.
const linkItems = () => screen.getAllByRole('menuitem', { name: 'Link do zgłoszeń' })
const printItems = () => screen.getAllByRole('menuitem', { name: 'Drukuj PDF' })

describe('KosztorysWorkersMenu', () => {
  it('lists every worker who holds an etap, once, in etap order', async () => {
    renderMenu()
    await openMenu()

    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByText('Anna Nowak')).toHaveLength(1)
    expect(within(menu).getByText('Bogdan Kowal')).toBeInTheDocument()
    expect(within(menu).queryByText('Celina Wiśniewska')).not.toBeInTheDocument()
    expect(linkItems()).toHaveLength(2)
  })

  it('disables a blocked worker’s link and says why, leaving the podgląd open', async () => {
    renderMenu()
    await openMenu()

    const [anna, bogdan] = linkItems()
    const [annaPrint, bogdanPrint] = printItems()
    expect(screen.getByText('Ustaw rozliczenie etapu')).toBeInTheDocument()
    expect(bogdan).toHaveAttribute('aria-disabled', 'true')
    expect(bogdanPrint).toHaveAttribute('aria-disabled', 'true')
    expect(anna).not.toHaveAttribute('aria-disabled')
    expect(annaPrint).not.toHaveAttribute('aria-disabled')
    const previews = screen.getAllByRole('menuitem', { name: 'Podgląd' })
    expect(previews[1]).toHaveAttribute(
      'href',
      `/podglad-pracownika/Bogdan-Kowal-20/${INVESTMENT_ID}`,
    )
  })

  // A live token outlives the block: once the rozliczenie is set it shows prices again, so the owner
  // must be able to switch it off while the worker is still blocked.
  it('opens a blocked worker’s link while they hold one', async () => {
    readWorkerShareHolders.mockResolvedValue([20])
    renderMenu()
    await openMenu()

    await waitFor(() => expect(linkItems()[1]).not.toHaveAttribute('aria-disabled'))
    expect(printItems()[1]).toHaveAttribute('aria-disabled', 'true')
    expect(readWorkerShareHolders).toHaveBeenCalledWith(INVESTMENT_ID)
  })

  it('lets a blocked holder’s link only be switched off, saying why', async () => {
    readWorkerShareHolders.mockResolvedValue([20])
    readWorkerShareToken.mockResolvedValue('tok-bogdan')
    renderMenu()
    await openMenu()
    await waitFor(() => expect(linkItems()[1]).not.toHaveAttribute('aria-disabled'))
    await userEvent.click(linkItems()[1])

    const dialog = await screen.findByRole('dialog', { name: /Bogdan Kowal/ })
    const revoke = await within(dialog).findByRole('button', { name: 'Wyłącz link' })
    expect(within(dialog).getByText('Ustaw rozliczenie etapu')).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Wygeneruj/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Kopiuj link' })).not.toBeInTheDocument()

    await userEvent.click(revoke)
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Wyłącz link' }))

    expect(revokeWorkerLinkAction).toHaveBeenCalledWith({
      investmentId: INVESTMENT_ID,
      workerId: 20,
    })
  })

  // A holder read started before the revoke carries the server's pre-revoke answer.
  it('keeps a revoked blocked worker’s link disabled when an older holder read lands late', async () => {
    let resolveStale: (ids: number[]) => void = () => {}
    readWorkerShareHolders
      .mockResolvedValueOnce([20])
      .mockReturnValueOnce(new Promise((resolve) => (resolveStale = resolve)))
      .mockReturnValue(new Promise(() => {}))
    readWorkerShareToken.mockResolvedValue('tok-bogdan')
    renderMenu()
    await openMenu()
    await waitFor(() => expect(linkItems()[1]).not.toHaveAttribute('aria-disabled'))
    await userEvent.keyboard('{Escape}')
    await openMenu()
    await userEvent.click(linkItems()[1])

    const dialog = await screen.findByRole('dialog', { name: /Bogdan Kowal/ })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Wyłącz link' }))
    const confirm = await screen.findByRole('alertdialog')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Wyłącz link' }))
    await within(dialog).findByText('Link nie jest wydany.')
    resolveStale([20])
    await userEvent.keyboard('{Escape}')
    await openMenu()

    expect(linkItems()[1]).toHaveAttribute('aria-disabled', 'true')
  })

  // Showing „nie jest wydany" — or offering „Wygeneruj link", which rotates a live one — on a read
  // that failed would state something nobody checked.
  it('closes the link dialog when the link cannot be prepared', async () => {
    ensureWorkerLinkAction.mockRejectedValue(new Error('offline'))
    renderMenu()
    await openMenu()
    await userEvent.click(linkItems()[0])

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Wygeneruj/ })).not.toBeInTheDocument()
  })

  it('keeps listing a worker unpinned from every etap while they hold a link', async () => {
    readWorkerShareHolders.mockResolvedValue([30])
    renderMenu()
    await openMenu()

    const menu = screen.getByRole('menu')
    expect(await within(menu).findByText('Celina Wiśniewska')).toBeInTheDocument()
    expect(within(menu).getByText('Brak przypisanych etapów')).toBeInTheDocument()
    const [, bogdan, celina] = linkItems()
    const [, , celinaPrint] = printItems()
    expect(celina).not.toHaveAttribute('aria-disabled')
    expect(celinaPrint).toHaveAttribute('aria-disabled', 'true')
    expect(bogdan).toHaveAttribute('aria-disabled', 'true')
  })

  // The link is handed out per investment, as the investor's is — so a manager may do it.
  it('lets a manager open the podgląd and the link of a worker', async () => {
    renderMenu('MANAGER')
    await openMenu()

    const [annaPreview] = screen.getAllByRole('menuitem', { name: 'Podgląd' })
    expect(annaPreview).toHaveAttribute(
      'href',
      `/podglad-pracownika/Anna-Nowak-10/${INVESTMENT_ID}`,
    )
    await userEvent.click(linkItems()[0])

    const dialog = await screen.findByRole('dialog', { name: /Anna Nowak/ })
    expect(
      await within(dialog).findByDisplayValue(/\/z\/Mieszkanie-Mokotow\/Anna-Nowak\/tok-anna$/),
    ).toBeInTheDocument()
    expect(ensureWorkerLinkAction).toHaveBeenCalledWith({
      investmentId: INVESTMENT_ID,
      workerId: 10,
    })
  })

  // Like the investor's „Udostępnij": the click is the hand-out, so the link lands in the clipboard.
  it('copies a worker’s link on the click', async () => {
    renderMenu()
    await openMenu()
    await userEvent.click(linkItems()[0])

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringMatching(/\/z\/Mieszkanie-Mokotow\/Anna-Nowak\/tok-anna$/),
      ),
    )
  })

  // A blocked holder's link opens only to be switched off — a copy would hand out a notice page.
  it('neither mints nor copies a blocked holder’s link', async () => {
    readWorkerShareHolders.mockResolvedValue([20])
    readWorkerShareToken.mockResolvedValue('tok-bogdan')
    renderMenu()
    await openMenu()
    await waitFor(() => expect(linkItems()[1]).not.toHaveAttribute('aria-disabled'))
    await userEvent.click(linkItems()[1])

    await screen.findByRole('dialog', { name: /Bogdan Kowal/ })
    expect(ensureWorkerLinkAction).not.toHaveBeenCalled()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('lets a manager print a worker’s PDF, reading that worker’s projection', async () => {
    const popup = { document: { title: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    renderMenu('MANAGER')
    await openMenu()

    await userEvent.click(printItems()[0])

    expect(open).toHaveBeenCalledOnce()
    expect(getWorkerKosztorysPrintData).toHaveBeenCalledWith(INVESTMENT_ID, 10)
    open.mockRestore()
  })

  // The settings are firm-wide, and the owner handed them to managers on purpose (0f664eec).
  it('lets a manager edit the view settings', async () => {
    renderMenu('MANAGER')
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /Ustawienia widoku/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Ustawienia widoku pracownika' })
    expect(await within(dialog).findByRole('checkbox', { name: 'Stawka j.m. netto' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Zapisz' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: /Ustaw kolejność kolumn/ })).toBeEnabled()
  })

  it('returns the owner’s reorder to the built-in order on reset', async () => {
    renderMenu('OWNER')
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /Ustawienia widoku/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ustawienia widoku pracownika' })
    await userEvent.click(
      await within(dialog).findByRole('button', { name: /Ustaw kolejność kolumn/ }),
    )
    const order = within(screen.getByRole('region', { name: 'Ustaw kolejność kolumn' }))
    const listed = () => order.getAllByRole('listitem').map((item) => item.textContent)
    const builtIn = WORKER_DOCUMENT_COLUMNS.slice(1).map((key) => workerColumnLabel(key) ?? key)
    const net = workerColumnLabel('net') ?? 'net'

    expect(listed()).toEqual(builtIn)
    await userEvent.click(order.getByRole('button', { name: `${net} na początek` }))
    expect(listed()[0]).toBe(net)
    await userEvent.click(order.getByRole('button', { name: 'Przywróć domyślną kolejność' }))

    expect(listed()).toEqual(builtIn)
  })

  it('lets the owner change the view settings', async () => {
    renderMenu('OWNER')
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /Ustawienia widoku/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Ustawienia widoku pracownika' })
    expect(await within(dialog).findByRole('checkbox', { name: 'Stawka j.m. netto' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Zapisz' })).toBeEnabled()
  })
})
