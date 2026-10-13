import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ExpenseDraftDuplicateHints,
  type DuplicateHintsStateT,
} from '@/components/worker-expenses/expense-draft-duplicate-hints'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { expenseReferenceData, expenseValues } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import type { DuplicateMatchT } from '@/lib/queries/expense-draft-duplicates'
import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => ({
  ingestFiles: async (picked: File[]) => ({ processed: picked, blocked: [] }),
}))

function match(overrides: Partial<DuplicateMatchT>): DuplicateMatchT {
  return {
    reasons: ['same-number'],
    key: 'transaction-501',
    source: 'transaction',
    id: 501,
    date: '2026-10-01',
    submitterName: 'Jan Kowalski',
    investmentName: 'Mieszkanie Mokotów',
    pages: [],
    amount: 89.9,
    documentNumber: 'PAR/2026/0001',
    sellerNip: null,
    documentDate: '2026-10-01',
    invoiceNote: null,
    description: 'Klej do płytek',
    ...overrides,
  }
}

function readyState(matches: DuplicateMatchT[]): DuplicateHintsStateT {
  return {
    status: 'ready',
    paragons: [{ readRow: 0, description: 'Klej', amount: 89.9, matches }],
  }
}

const onRowA = () => 'row-a'

function scanned(description: string, amount: number): ReceiptFillResultT {
  return { description, amount, netAmount: null, invoiceNote: '' } as ReceiptFillResultT
}

beforeEach(() => {
  vi.clearAllMocks()
  useOptimisticFormStore.setState({ keepOpen: false })
})

describe('ExpenseDraftDuplicateHints', () => {
  it('lists every match of a paragon and marks the chosen one as its duplicate', async () => {
    const onMarkDuplicate = vi.fn()
    render(
      <ExpenseDraftDuplicateHints
        state={readyState([
          match({ key: 'transaction-501', source: 'transaction', id: 501 }),
          match({ key: 'draft-7-1', source: 'draft', id: 7, documentNumber: 'PAR/2026/0002' }),
        ])}
        lineItemIds={['row-a']}
        itemIdOfReadRow={onRowA}
        onMarkDuplicate={onMarkDuplicate}
      />,
    )

    expect(screen.getByText('Możliwe duplikaty')).toBeInTheDocument()
    const transactionRow = screen.getByText('Transakcja #501').closest('tr')!
    expect(screen.getByText('Zgłoszenie #7')).toBeInTheDocument()

    await userEvent.setup().click(within(transactionRow).getByRole('button', { name: 'Duplikat' }))

    expect(onMarkDuplicate).toHaveBeenCalledWith('row-a', { source: 'transaction', id: 501 })
  })

  it('dismisses only the clicked match when two come from the same zgłoszenie', async () => {
    render(
      <ExpenseDraftDuplicateHints
        state={readyState([
          match({ key: 'draft-7-1', source: 'draft', id: 7, documentNumber: 'PAR/2026/0001' }),
          match({ key: 'draft-7-2', source: 'draft', id: 7, documentNumber: 'PAR/2026/0002' }),
        ])}
        lineItemIds={['row-a']}
        itemIdOfReadRow={onRowA}
        onMarkDuplicate={vi.fn()}
      />,
    )

    const firstRow = screen.getByText('PAR/2026/0001').closest('tr')!
    await userEvent
      .setup()
      .click(within(firstRow).getByRole('button', { name: 'OK, to nie duplikat' }))

    expect(screen.queryByText('PAR/2026/0001')).toBeNull()
    expect(screen.getByText('PAR/2026/0002')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Duplikat' })).toHaveLength(1)
  })

  it.each<[DuplicateHintsStateT, string]>([
    [{ status: 'reading' }, 'Odczytywanie paragonów — duplikaty sprawdzimy po odczycie.'],
    [{ status: 'checking' }, 'Sprawdzanie duplikatów…'],
    [{ status: 'no-read' }, 'Bez odczytu paragonów nie da się sprawdzić duplikatów.'],
    [
      { status: 'error', message: 'Nie udało się sprawdzić duplikatów' },
      'Nie udało się sprawdzić duplikatów',
    ],
  ])('shows the %o notice and offers no „Duplikat"', (state, notice) => {
    render(
      <ExpenseDraftDuplicateHints
        state={state}
        lineItemIds={['row-a']}
        itemIdOfReadRow={onRowA}
        onMarkDuplicate={vi.fn()}
      />,
    )

    expect(screen.getByText(notice)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duplikat' })).toBeNull()
  })
})

describe('ExpenseForm with duplicate hints', () => {
  const receipts = () =>
    new Map([
      [0, [new File(['jpg'], 'pierwszy.jpg', { type: 'image/jpeg' })]],
      [1, [new File(['jpg'], 'drugi.jpg', { type: 'image/jpeg' })]],
    ])

  function renderAcceptance(
    rows: Partial<BulkExpenseFormValuesT['lineItems'][number]>[],
    files: Map<number, File[]>,
  ) {
    const items = rows.map((row) => makeLineItem({ expenseCategory: '1', ...row }))
    const duplicates = readyState([match({ source: 'transaction', id: 501 })])
    render(
      <ExpenseForm
        referenceData={expenseReferenceData}
        onSubmitSuccess={vi.fn()}
        formId="expense-draft-42"
        prefill={{
          expenseDraftId: 42,
          receipts: new Map(
            items.map((item, readRow) => [item.id, [{ mediaIds: [101 + readRow], readRow }]]),
          ),
          aiReadRows: [],
          pagesByMediaId: new Map(),
          files,
          values: expenseValues({ lineItems: items }),
        }}
        renderAboveLineItems={({ lineItemIds, markDuplicate, itemIdOfReadRow }) => (
          <ExpenseDraftDuplicateHints
            state={duplicates}
            lineItemIds={lineItemIds}
            itemIdOfReadRow={itemIdOfReadRow}
            onMarkDuplicate={markDuplicate}
          />
        )}
      />,
    )
  }

  it('lands an in-flight scan on its own row after „Duplikat" removes the row above it', async () => {
    const releases = new Map<string, (data: ReceiptFillResultT) => void>()
    vi.mocked(scanReceiptClient).mockImplementation(
      (files) => new Promise((resolve) => releases.set(files[0].name, resolve)),
    )
    renderAcceptance([{}, {}], receipts())
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Odczytaj dodane zdjęcia' }))
    await waitFor(() => expect(releases.size).toBe(2))
    await user.click(screen.getByRole('button', { name: 'Duplikat' }))
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Opis' })).toHaveLength(1))

    releases.get('drugi.jpg')!(scanned('Fuga szara', 45))
    expect(await screen.findByDisplayValue('Fuga szara')).toBeInTheDocument()

    releases.get('pierwszy.jpg')!(scanned('Klej do płytek', 89.9))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Odczytaj dodane zdjęcia' })).toBeNull(),
    )
    expect(screen.getAllByRole('textbox', { name: 'Opis' })).toHaveLength(1)
    expect(screen.getByDisplayValue('Fuga szara')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Klej do płytek')).toBeNull()
  })

  it('carries the „Duplikat" mark to the save as the skipped paragon', async () => {
    renderAcceptance(
      [
        { description: 'Klej do płytek', amount: '89.9', netAmount: '73.09' },
        { description: 'Fuga szara', amount: '45', netAmount: '36.59' },
      ],
      new Map(),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Duplikat' }))
    await waitFor(() => expect(screen.queryByDisplayValue('Klej do płytek')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))
    await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createBulkTransferAction).mock.calls[0][2]).toEqual({
      expenseDraftId: 42,
      receiptMediaIds: [[102]],
      receiptReadRows: [[1]],
      skippedReceipts: [
        { mediaIds: [101], readRow: 0, duplicateOf: { source: 'transaction', id: 501 } },
      ],
    })
  })

  it('moves a paragon’s hint onto the merged row, and „Duplikat" there skips every paragon', async () => {
    renderAcceptance(
      [
        { description: 'Klej do płytek', amount: '89.9' },
        { description: 'Fuga szara', amount: '45' },
        { description: 'Silikon', amount: '20' },
      ],
      new Map(),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('checkbox', { name: 'Zaznacz pozycję 2' }))
    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz pozycję 1' }))
    await user.click(screen.getByRole('button', { name: 'Połącz zaznaczone (2)' }))
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Opis' })).toHaveLength(2))

    await user.click(screen.getByRole('button', { name: 'Duplikat' }))
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Opis' })).toHaveLength(1))
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))
    await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    const duplicateOf = { source: 'transaction', id: 501 }
    expect(vi.mocked(createBulkTransferAction).mock.calls[0][2]).toEqual({
      expenseDraftId: 42,
      receiptMediaIds: [[103]],
      receiptReadRows: [[2]],
      skippedReceipts: [
        { mediaIds: [101], readRow: 0, duplicateOf },
        { mediaIds: [102], readRow: 1, duplicateOf },
      ],
    })
  })
})
