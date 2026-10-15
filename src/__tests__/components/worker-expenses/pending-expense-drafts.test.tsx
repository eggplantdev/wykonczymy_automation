import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PendingExpenseDrafts } from '@/components/worker-expenses/pending-expense-drafts'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { toastMessage } from '@/lib/utils/toast'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'

const replace = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh: vi.fn(), replace }),
}))
const { readExpenseDraftAction, rejectExpenseDraftAction } = vi.hoisted(() => ({
  readExpenseDraftAction: vi.fn(),
  rejectExpenseDraftAction: vi.fn(),
}))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  readExpenseDraftAction,
  rejectExpenseDraftAction,
}))
vi.mock('@/lib/actions/transfers', () => ({ createBulkTransferAction: vi.fn() }))
vi.mock('@/lib/queries/expense-draft-duplicates', () => ({
  findExpenseDraftDuplicates: vi.fn(async () => ({ success: true, data: [] })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => ({
  ingestFiles: async (picked: File[]) => ({ processed: picked, blocked: [] }),
}))

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
  acceptedReadRows: [],
  rejectedReceipts: [],
  media: [{ id: 11, url: '/m/11.jpg', filename: 'leroy.jpg', mimeType: 'image/jpeg' }],
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

describe('„Zweryfikuj" na zgłoszeniu, którego zdjęć nie da się pobrać', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    )
  })

  it('otwiera dialog bez zapisu i bez odczytu, a zgłoszenie da się odrzucić', async () => {
    rejectExpenseDraftAction.mockResolvedValue({ success: true, data: undefined })
    render(<PendingExpenseDrafts drafts={[draft]} referenceData={referenceData} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zweryfikuj' }))

    expect(await screen.findByRole('button', { name: 'Zapisz' })).toBeDisabled()
    expect(
      screen.getByText('Nie udało się pobrać zdjęć — zgłoszenie można tylko odrzucić.'),
    ).toBeInTheDocument()
    expect(readExpenseDraftAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Odrzuć' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Odrzuć' }),
    )

    expect(rejectExpenseDraftAction).toHaveBeenCalledWith(draft.id, undefined)
  })

  it('w odczytanym zgłoszeniu blokuje przyjęcie paragonu bez zdjęcia, a zdjęcie dodane ręcznie je zdejmuje', async () => {
    const user = userEvent.setup()
    render(
      <PendingExpenseDrafts drafts={[{ ...draft, aiRead: read }]} referenceData={referenceData} />,
    )

    await user.click(screen.getByRole('button', { name: 'Zweryfikuj' }))

    expect(
      await screen.findByText(
        'Nie udało się pobrać zdjęcia paragonu — dodaj je w polu „FV”, żeby go przyjąć.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Przyjmij' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Odrzuć' })).toBeEnabled()

    const fvInput = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(fvInput, new File(['jpg'], 'paragon.jpg', { type: 'image/jpeg' }))

    expect(await screen.findByRole('button', { name: 'Przyjmij' })).toBeEnabled()
    expect(screen.queryByText(/Nie udało się pobrać zdjęcia paragonu/)).toBeNull()
  })
})

describe('zgłoszenie bez inwestycji', () => {
  it('stoi w kolejce jako „Bez inwestycji”', () => {
    render(
      <PendingExpenseDrafts
        drafts={[{ ...draft, investmentId: null, investmentName: null }]}
        referenceData={referenceData}
      />,
    )

    expect(screen.getByRole('cell', { name: 'Bez inwestycji' })).toBeInTheDocument()
  })
})

describe('link z „Szukaj duplikatów” (?zgloszenie=N)', () => {
  beforeEach(() => {
    readExpenseDraftAction.mockResolvedValue({ success: true, data: { aiRead: read } })
    window.history.replaceState(null, '', '/zgloszenia-wydatkow?zgloszenie=7&status=pending')
  })

  // A navigation on arrival discarded the dialog's in-flight server actions, so the duplicate
  // check never settled; the parameter now goes only when the dialog closes.
  it('otwiera dialog wskazanego zgłoszenia raz, a parametr zdejmuje dopiero przy zamknięciu', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <PendingExpenseDrafts
        drafts={[draft]}
        referenceData={referenceData}
        openDraftId={draft.id}
      />,
    )

    expect(await screen.findByDisplayValue('Klej do płytek')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?zgloszenie=7&status=pending')

    rerender(
      <PendingExpenseDrafts
        drafts={[{ ...draft }]}
        referenceData={referenceData}
        openDraftId={draft.id}
      />,
    )
    expect(readExpenseDraftAction).toHaveBeenCalledTimes(1)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?status=pending')
  })

  it('o rozpatrzonym już zgłoszeniu mówi toastem i niczego nie otwiera, także przy pustej kolejce', () => {
    render(<PendingExpenseDrafts drafts={[]} referenceData={referenceData} openDraftId={99} />)

    expect(toastMessage).toHaveBeenCalledWith('To zgłoszenie zostało już rozpatrzone.', 'warning')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?status=pending')
  })
})
