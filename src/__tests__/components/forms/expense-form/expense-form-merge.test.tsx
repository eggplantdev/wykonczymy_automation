import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { expenseReferenceData, expenseValues } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { rejectExpenseParagonsAction } from '@/lib/actions/worker-expense-drafts'
import type { ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftMediaT } from '@/lib/db/worker-expense-drafts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  rejectExpenseParagonsAction: vi.fn(async () => ({ success: true, data: [] })),
  restoreSkippedReceiptAction: vi.fn(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => ({
  ingestFiles: async (picked: File[]) => ({ processed: picked, blocked: [] }),
}))
// The upload leg is not what these specs watch.
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

// Two paragony on photo 101, a third on photo 102; the AI read no Kwota off the ticket.
const AI_READ: ExpenseDraftReadT = {
  rows: [
    { mediaIds: [101], description: 'Parking', amount: 12.35, filename: 'parking' },
    { mediaIds: [101], description: 'Bilet', filename: 'bilet' },
    { mediaIds: [102], description: 'Paliwo', amount: 200.1, filename: 'paliwo' },
  ],
}

function renderDraft() {
  const prefill = buildDraftPrefill({ media: MEDIA, aiRead: AI_READ }, FILES, '1')
  render(
    <ExpenseForm
      referenceData={expenseReferenceData}
      onSubmitSuccess={vi.fn()}
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

async function merge(user: ReturnType<typeof userEvent.setup>, rows: number[]) {
  for (const row of rows) {
    await user.click(screen.getByRole('checkbox', { name: `Zaznacz pozycję ${row}` }))
  }
  await user.click(screen.getByRole('button', { name: 'Połącz zaznaczone w 1 transakcję' }))
  await waitFor(() => expect(descriptions()).toHaveLength(4 - rows.length))
}

// Rows keep the order of the worker's photos, so a merged row sits at its earliest paragon.
async function decide(
  user: ReturnType<typeof userEvent.setup>,
  decision: 'Przyjmij' | 'Odrzuć',
  row: number,
) {
  await user.click(screen.getAllByRole('button', { name: decision })[row])
}

beforeEach(() => {
  vi.clearAllMocks()
  useOptimisticFormStore.setState({ keepOpen: false })
})

describe('„Połącz zaznaczone” / „Rozłącz” in „Przyjmij”', () => {
  it('merges two rows into one: summed Kwota, a shared photo once, „Rozłącz” in place of „Odczytaj ponownie”', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await merge(user, [1, 3])

    expect(descriptions()).toEqual(['Parking', 'Bilet'])
    expect(screen.getByDisplayValue('212.45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rozłącz' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Odczytaj ponownie' })).toHaveLength(1)
  })

  it('keeps a photo two merged paragony share only once', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await merge(user, [1, 2])

    expect(screen.getAllByText(/zdjecie-101/)).toHaveLength(1)
  })

  it('keeps the camera filename on the merged pages', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')

    await merge(user, [1, 3])

    expect(screen.getAllByText(/zdjecie-10[12]/).length).toBeGreaterThan(0)
    expect(screen.queryByText('parking')).toBeNull()
  })

  it('says „nie odczytano” when a merged paragon had no Kwota', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')
    expect(screen.queryByText('nie odczytano')).toBeNull()

    await merge(user, [1, 2])

    expect(screen.getByText('nie odczytano')).toBeInTheDocument()
  })

  it('keeps „nie odczytano” when a short merged row is merged again', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')
    await merge(user, [1, 2])

    // The merged row stays selected, so ticking the other one is enough.
    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz pozycję 2' }))
    await user.click(screen.getByRole('button', { name: 'Połącz zaznaczone w 1 transakcję' }))
    await waitFor(() => expect(descriptions()).toEqual(['Parking']))

    expect(screen.getByDisplayValue('212.45')).toBeInTheDocument()
    expect(screen.getByText('nie odczytano')).toBeInTheDocument()
  })

  it('„Rozłącz” rebuilds the paragony from the read, dropping what was typed into the merged row', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')
    await merge(user, [1, 3])
    const merged = screen.getAllByRole('textbox', { name: 'Opis' })[0]
    await user.clear(merged)
    await user.type(merged, 'Wpisane ręcznie')

    await user.click(screen.getByRole('button', { name: 'Rozłącz' }))

    await waitFor(() => expect(descriptions()).toEqual(['Parking', 'Bilet', 'Paliwo']))
    expect(screen.queryByRole('button', { name: 'Rozłącz' })).toBeNull()
    expect(screen.queryByText('nie odczytano')).toBeNull()
  })

  it('books a merged row as the union of its photos and its read rows', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')
    await merge(user, [2, 3])

    await decide(user, 'Przyjmij', 1)

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    const [data, , opts] = vi.mocked(createBulkTransferAction).mock.calls[0]
    expect(data.lineItems).toHaveLength(1)
    expect(opts).toEqual({
      expenseDraftId: 42,
      receiptMediaIds: [[101, 102]],
      receiptReadRows: [[1, 2]],
      skippedReceipts: [],
    })
  })

  it('a merged row refused refuses each of its paragony', async () => {
    const user = renderDraft()
    await screen.findByDisplayValue('Paliwo')
    await merge(user, [1, 2])

    await decide(user, 'Odrzuć', 0)

    await waitFor(() => expect(rejectExpenseParagonsAction).toHaveBeenCalledTimes(1))
    expect(rejectExpenseParagonsAction).toHaveBeenCalledWith(42, [
      { mediaIds: [101], readRow: 0, duplicateOf: undefined },
      { mediaIds: [101], readRow: 1, duplicateOf: undefined },
    ])
  })
})
