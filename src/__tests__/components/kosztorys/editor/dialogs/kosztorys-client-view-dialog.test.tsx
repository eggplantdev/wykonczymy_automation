import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysClientViewDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import {
  clientDocumentColumns,
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view/settings'
import { COLUMN_LABELS } from '@/lib/kosztorys/column-config'
import type { ColumnRanksT } from '@/lib/table/column-order'

const INVESTMENT_ID = 7

const saveClientViewSettingsAction = vi.hoisted(() => vi.fn())
const saveClientViewDefaultsAction = vi.hoisted(() => vi.fn())
const investor = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}))

vi.mock(
  '@/components/ui/column-order-dialog',
  () => import('@/__tests__/stubs/column-order-dialog'),
)
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/kosztorys-client-view', () => ({
  saveClientViewSettingsAction,
  saveClientViewDefaultsAction,
}))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({ investmentId: INVESTMENT_ID, conditionCounts: new Map() }),
}))
vi.mock('@/components/kosztorys/editor/actions/kosztorys-actions-context', () => ({
  useKosztorysActions: () => ({ investor: investor.value }),
}))

// The firm's order puts „Pozostało" first; the investment's own row has no order of its own.
const FIRM_RANKS: ColumnRanksT = { remaining: -1 }
const setClientView = vi.fn()

function renderDialog(settings: ClientViewSettingsT = sanitizeClientViewSettings({})) {
  investor.value = {
    settingsOpen: true,
    setSettingsOpen: vi.fn(),
    clientView: settings,
    setClientView,
    defaultColumnRanks: FIRM_RANKS,
  }
  render(
    <CurrentUserProvider user={{ id: 1, email: 'o@example.test', name: 'Testowy', role: 'OWNER' }}>
      <KosztorysClientViewDialog />
    </CurrentUserProvider>,
  )
  return screen.getByRole('dialog', { name: 'Ustawienia podglądu inwestora' })
}

async function openOrder(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: /Ustaw kolejność kolumn/ }))
  return within(screen.getByRole('region', { name: 'Ustaw kolejność kolumn' }))
}

const listed = (order: ReturnType<typeof within>) =>
  order.getAllByRole('listitem').map((item: HTMLElement) => item.textContent)

describe('KosztorysClientViewDialog — kolejność kolumn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveClientViewSettingsAction.mockResolvedValue({ success: true })
  })

  it('pokazuje „Opis prac" jako zaznaczony i zablokowany', () => {
    const dialog = renderDialog()

    const pinned = within(dialog).getByRole('checkbox', { name: 'Opis prac' })
    expect(pinned).toBeChecked()
    expect(pinned).toBeDisabled()
  })

  it('okno kolejności nie wymienia „Opis prac"', async () => {
    const order = await openOrder(renderDialog())

    expect(listed(order)).not.toContain(COLUMN_LABELS.description)
    expect(listed(order)).toContain(COLUMN_LABELS.plannedNet)
  })

  it('przywrócenie wraca do kolejności firmy, nie do wbudowanej', async () => {
    const order = await openOrder(renderDialog())

    await userEvent.click(
      order.getByRole('button', { name: `${COLUMN_LABELS.plannedNet} na początek` }),
    )
    expect(listed(order)[0]).toBe(COLUMN_LABELS.plannedNet)
    await userEvent.click(order.getByRole('button', { name: 'Przywróć domyślną kolejność' }))

    expect(listed(order)[0]).toBe(COLUMN_LABELS.remaining)
    expect(order.getByRole('button', { name: 'Przywróć domyślną kolejność' })).toBeDisabled()
  })

  it('„Zapisz" wysyła przesuniętą kolejność razem z ustawieniami', async () => {
    const dialog = renderDialog()
    const order = await openOrder(dialog)

    await userEvent.click(
      order.getByRole('button', { name: `${COLUMN_LABELS.plannedNet} na początek` }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Zapisz' }))

    expect(saveClientViewSettingsAction).toHaveBeenCalledOnce()
    const [investmentId, saved] = saveClientViewSettingsAction.mock.calls[0]!
    expect(investmentId).toBe(INVESTMENT_ID)
    expect(clientDocumentColumns(saved.columnRanks).slice(0, 2)).toEqual([
      'description',
      'plannedNet',
    ])
  })

  it('zamknięcie bez „Zapisz" niczego nie zapisuje', async () => {
    const dialog = renderDialog()
    const order = await openOrder(dialog)

    await userEvent.click(
      order.getByRole('button', { name: `${COLUMN_LABELS.plannedNet} na początek` }),
    )
    await userEvent.keyboard('{Escape}')

    expect(saveClientViewSettingsAction).not.toHaveBeenCalled()
    expect(setClientView).not.toHaveBeenCalled()
  })
})
