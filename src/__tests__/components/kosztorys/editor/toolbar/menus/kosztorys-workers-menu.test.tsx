import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { KosztorysWorkersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu'
import { KosztorysWorkerShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-worker-share-dialog'
import { KosztorysWorkerViewDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-worker-view-dialog'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import type { RoleT } from '@/lib/auth/roles'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

const INVESTMENT_ID = 12

// Anna holds two etapy (listed once), Bogdan one with no rozliczenie yet (blocked), Celina none.
// Bogdan is inactive: a person deactivated mid-investment still owns their etapy.
const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: 'Etap 1', plane: 'w_tools', workerId: 10 },
  { id: 2, ordinal: 2, label: 'Etap 2', plane: null, workerId: 20 },
  { id: 3, ordinal: 3, label: 'Etap 3', plane: 'w_tools', workerId: 10 },
  { id: 4, ordinal: 4, label: 'Etap 4', plane: 'own_tools', workerId: null },
]
const ROSTER = [
  { id: 10, name: 'Anna Nowak', active: true },
  { id: 20, name: 'Bogdan Kowal', active: false },
  { id: 30, name: 'Celina Wiśniewska', active: true },
]

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: INVESTMENT_ID,
    stages: STAGES,
    workers: ROSTER,
  }),
}))

vi.mock('@/lib/queries/worker-view-settings-endpoint', () => ({
  readWorkerViewSettings: vi.fn(async () => ({ hiddenColumns: [], hideEmptyRows: true })),
}))

const getWorkerShareLinkAction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/kosztorys-worker-share', () => ({
  getWorkerShareLinkAction,
  generateWorkerShareLinkAction: vi.fn(),
  revokeWorkerShareLinkAction: vi.fn(),
}))

beforeEach(() => {
  getWorkerShareLinkAction.mockResolvedValue({ success: true, data: 'tok-anna' })
})

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

// Items render in worker order, so the n-th „Link" belongs to the n-th listed worker.
const linkItems = () => screen.getAllByRole('menuitem', { name: 'Link' })

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
    expect(screen.getByText('Ustaw rozliczenie etapu')).toBeInTheDocument()
    expect(bogdan).toHaveAttribute('aria-disabled', 'true')
    expect(anna).not.toHaveAttribute('aria-disabled')
    const previews = screen.getAllByRole('menuitem', { name: 'Podgląd' })
    expect(previews[1]).toHaveAttribute('href', `/podglad-pracownika/${INVESTMENT_ID}/20`)
  })

  // The link is handed out per investment, as the investor's is — so a manager may do it.
  it('lets a manager open the podgląd and the link of a worker', async () => {
    renderMenu('MANAGER')
    await openMenu()

    const [annaPreview] = screen.getAllByRole('menuitem', { name: 'Podgląd' })
    expect(annaPreview).toHaveAttribute('href', `/podglad-pracownika/${INVESTMENT_ID}/10`)
    await userEvent.click(linkItems()[0])

    const dialog = await screen.findByRole('dialog', { name: /Anna Nowak/ })
    expect(await within(dialog).findByDisplayValue(/\/p\/tok-anna$/)).toBeInTheDocument()
    expect(getWorkerShareLinkAction).toHaveBeenCalledWith({
      investmentId: INVESTMENT_ID,
      workerId: 10,
    })
  })

  // The settings are firm-wide: a manager saving them would change every worker's live link.
  it('opens the view settings read-only for a manager', async () => {
    renderMenu('MANAGER')
    await openMenu()
    await userEvent.click(screen.getByRole('menuitem', { name: /Ustawienia widoku/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Ustawienia widoku pracownika' })
    expect(
      await within(dialog).findByRole('checkbox', { name: 'Stawka j.m. netto' }),
    ).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Zapisz' })).toBeDisabled()
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
