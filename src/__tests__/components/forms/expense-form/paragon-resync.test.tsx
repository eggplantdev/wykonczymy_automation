import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { expenseReferenceData, expenseValues } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftMediaT } from '@/lib/db/worker-expense-drafts'
import { fetchExpenseDraftDecisions } from '@/lib/queries/expense-draft-decisions'
import { toastMessage } from '@/lib/utils/toast'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

vi.mock('next/navigation', () => ({ usePathname: () => '/', unstable_rethrow: () => {} }))
vi.mock('@/lib/actions/transfers', () => ({ createBulkTransferAction: vi.fn() }))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  rejectExpenseParagonsAction: vi.fn(),
  restoreSkippedReceiptAction: vi.fn(),
}))
vi.mock('@/lib/queries/expense-draft-decisions', () => ({ fetchExpenseDraftDecisions: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => ({
  ingestFiles: async (picked: File[]) => ({ processed: picked, blocked: [] }),
}))
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploadRows: async (
    _count: number,
    _files: unknown,
    run: (rows: number[][]) => Promise<unknown>,
  ) => run([]),
}))

const page = (id: number): ExpenseDraftMediaT => ({
  id,
  url: `/m/${id}.jpg`,
  filename: `zdjecie-${id}.jpg`,
  mimeType: 'image/jpeg',
})
const MEDIA = [page(101), page(102)]
const FILES = MEDIA.map((m) => new File(['jpg'], m.filename, { type: m.mimeType }))

const AI_READ: ExpenseDraftReadT = {
  rows: [
    { mediaIds: [101], description: 'Parking', amount: 12.35, filename: 'parking' },
    { mediaIds: [101], description: 'Bilet', filename: 'bilet' },
    { mediaIds: [102], description: 'Paliwo', amount: 200.1, filename: 'paliwo' },
  ],
}

function renderDraft(onSubmitSuccess = vi.fn()) {
  const prefill = buildDraftPrefill({ media: MEDIA, aiRead: AI_READ }, FILES, '1')
  render(
    <ExpenseForm
      referenceData={expenseReferenceData}
      onSubmitSuccess={onSubmitSuccess}
      formId="expense-draft-42"
      prefill={{
        expenseDraftId: 42,
        receipts: prefill.receipts,
        aiReadRows: AI_READ.rows,
        pagesByMediaId: prefill.pagesByMediaId,
        files: prefill.files,
        values: expenseValues({
          investment: '3',
          sourceRegister: '7',
          lineItems: prefill.lineItems,
        }),
      }}
    />,
  )
  return userEvent.setup()
}

const descriptions = () =>
  screen.getAllByRole('textbox', { name: 'Opis' }).map((input) => (input as HTMLInputElement).value)

beforeEach(() => {
  vi.clearAllMocks()
  useOptimisticFormStore.setState({ keepOpen: false })
})

describe('a paragon decision the server refused or never answered', () => {
  it('re-reads the zgłoszenie and drops the paragony decided elsewhere', async () => {
    vi.mocked(createBulkTransferAction).mockResolvedValue({
      success: false,
      error: 'Już rozpatrzone paragony: nr 3. Lista została odświeżona.',
      code: 'ALREADY_DECIDED',
    })
    vi.mocked(fetchExpenseDraftDecisions).mockResolvedValue({
      success: true,
      data: { status: 'pending', acceptedReadRows: [2], rejectedReceipts: [] },
    })
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await user.click(screen.getAllByRole('button', { name: 'Przyjmij' })[2])

    await waitFor(() => expect(descriptions()).toEqual(['Parking', 'Bilet']))
    expect(fetchExpenseDraftDecisions).toHaveBeenCalledWith(42)
    expect(screen.getAllByRole('button', { name: 'Przyjmij' })[0]).toBeEnabled()
  })

  it('closes when a lost response turns out to have settled the zgłoszenie', async () => {
    vi.mocked(createBulkTransferAction).mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(fetchExpenseDraftDecisions).mockResolvedValue({
      success: true,
      data: { status: 'accepted', acceptedReadRows: [0, 1, 2], rejectedReceipts: [] },
    })
    const onSubmitSuccess = vi.fn()
    const user = renderDraft(onSubmitSuccess)
    await screen.findByDisplayValue('Paliwo')

    await user.click(screen.getAllByRole('button', { name: 'Przyjmij' })[0])

    await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalledTimes(1))
    expect(toastMessage).toHaveBeenCalledWith('To zgłoszenie zostało już rozpatrzone.', 'warning')
  })

  it('says so when the re-read fails too, instead of leaving a list the server disowns', async () => {
    vi.mocked(createBulkTransferAction).mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(fetchExpenseDraftDecisions).mockRejectedValue(new TypeError('Failed to fetch'))
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await user.click(screen.getAllByRole('button', { name: 'Przyjmij' })[0])

    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith(
        'Nie udało się odświeżyć paragonów — otwórz zgłoszenie ponownie',
        'error',
      ),
    )
  })

  it('leaves the list as it was when the business refusal needs no re-read', async () => {
    vi.mocked(createBulkTransferAction).mockResolvedValue({ success: false, error: 'Kasa w koszu' })
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await user.click(screen.getAllByRole('button', { name: 'Przyjmij' })[0])

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith('Kasa w koszu', 'error'))
    expect(fetchExpenseDraftDecisions).not.toHaveBeenCalled()
    expect(descriptions()).toEqual(['Parking', 'Bilet', 'Paliwo'])
  })
})

describe('„Przyjmij” on an incomplete paragon', () => {
  it('marks the field on the row instead of booking it', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await user.click(screen.getAllByRole('button', { name: 'Przyjmij' })[1])

    expect(await screen.findByText('Kwota musi być większa niż 0')).toBeInTheDocument()
    expect(createBulkTransferAction).not.toHaveBeenCalled()
    expect(toastMessage).not.toHaveBeenCalled()
  })
})
