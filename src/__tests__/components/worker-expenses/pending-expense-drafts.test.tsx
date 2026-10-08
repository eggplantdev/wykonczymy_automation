import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { toastMessage } from '@/lib/utils/toast'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh: vi.fn() }),
}))
const { readExpenseDraftAction } = vi.hoisted(() => ({ readExpenseDraftAction: vi.fn() }))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  readExpenseDraftAction,
  rejectExpenseDraftAction: vi.fn(),
}))
vi.mock('@/lib/actions/transfers', () => ({ createBulkTransferAction: vi.fn() }))
vi.mock('@/lib/queries/expense-draft-duplicates', () => ({
  findExpenseDraftDuplicates: vi.fn(async () => ({ success: true, data: [] })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const draft: ExpenseDraftRowT = {
  id: 7,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 3,
  investmentName: 'Mieszkanie Mokotów',
  cashRegisterId: 1,
  note: null,
  status: 'pending',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: null,
  decidedByName: null,
  transfers: [],
  media: [{ id: 11, url: '/m/11.jpg', filename: 'leroy.jpg', mimeType: 'image/jpeg' }],
  scanMode: 'one-invoice',
  aiRead: undefined,
}
const read: ExpenseDraftReadT = { rows: [{ mediaIds: [11], description: 'Klej do płytek' }] }

const referenceData = {
  ...referenceDataFor('OWNER'),
  cashRegisters: [{ id: 1, name: 'Kasa główna', type: 'MAIN' as const }],
  investments: [{ id: 3, name: 'Mieszkanie Mokotów', status: 'active' as const }],
} as unknown as ReturnType<typeof referenceDataFor>

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Blob(['jpg'], { type: 'image/jpeg' }))),
  )
  useOptimisticFormStore.setState({ openFormId: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('„Zweryfikuj" na zgłoszeniu bez odczytu', () => {
  it('ponowne otwarcie w trakcie odczytu nie zleca drugiego', async () => {
    let land: (value: unknown) => void = () => {}
    readExpenseDraftAction.mockReturnValue(new Promise((resolve) => (land = resolve)))
    render(<PendingExpenseDrafts drafts={[draft]} referenceData={referenceData} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zweryfikuj' }))
    expect(await screen.findByRole('textbox', { name: 'Opis' })).toBeDisabled()
    act(() => useOptimisticFormStore.getState().closeDialog())
    await user.click(screen.getByRole('button', { name: 'Zweryfikuj' }))
    await screen.findByRole('textbox', { name: 'Opis' })
    await act(async () => land({ success: true, data: { aiRead: read } }))

    expect(await screen.findByDisplayValue('Klej do płytek')).toBeEnabled()
    expect(readExpenseDraftAction).toHaveBeenCalledTimes(1)
  })

  it('nieudany odczyt mówi, dlaczego, i odblokowuje pusty wiersz', async () => {
    readExpenseDraftAction.mockResolvedValue({ success: false, error: 'Brak uprawnień' })
    render(<PendingExpenseDrafts drafts={[draft]} referenceData={referenceData} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Zweryfikuj' }))

    expect(await screen.findByRole('textbox', { name: 'Opis' })).toBeEnabled()
    expect(toastMessage).toHaveBeenCalledWith('Brak uprawnień', 'warning')
  })
})
