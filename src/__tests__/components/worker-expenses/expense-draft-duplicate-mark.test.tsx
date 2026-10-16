import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseDraftDuplicateHints } from '@/components/worker-expenses/expense-draft-duplicate-hints'
import {
  ExpenseDraftDuplicateStatus,
  type DuplicateHintsStateT,
} from '@/components/worker-expenses/expense-draft-duplicate-status'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'
import { ExpenseForm, type ParagonRowT } from '@/components/forms/expense-form/expense-form'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { expenseReferenceData, expenseValues } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import type { DuplicateMatchT } from '@/lib/expense-duplicates/types'
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
    draftId: null,
    readRows: [],
    date: '2026-10-01',
    investmentId: 7,
    submitterName: 'Jan Kowalski',
    registerName: 'Kasa Jana',
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

function oneParagon(matches: DuplicateMatchT[]): ParagonDuplicatesT[] {
  return [{ readRow: 0, description: 'Klej', amount: 89.9, matches }]
}

// The dialog holds the dismissals above the rows; this stands in for it.
function Hints(
  props: Omit<
    React.ComponentProps<typeof ExpenseDraftDuplicateHints>,
    'dismissed' | 'onDismiss' | 'disabled'
  >,
) {
  const [dismissed, setDismissed] = useState(() => new Set<string>())
  return (
    <ExpenseDraftDuplicateHints
      {...props}
      dismissed={dismissed}
      onDismiss={(key) => setDismissed((prev) => new Set(prev).add(key))}
      disabled={false}
    />
  )
}

const onRowA = () => ({ itemId: 'row-a', position: 0, status: 'pending' as const })
const renderRow = (hint: React.ReactNode) => hint

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
      <Hints
        paragons={oneParagon([
          match({ key: 'transaction-501', source: 'transaction', id: 501 }),
          match({ key: 'draft-7-1', source: 'draft', id: 7, documentNumber: 'PAR/2026/0002' }),
        ])}
        draftId={42}
        itemId="row-a"
        paragonOfReadRow={onRowA}
        onMarkDuplicate={onMarkDuplicate}
        renderRow={renderRow}
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
      <Hints
        paragons={oneParagon([
          match({ key: 'draft-7-1', source: 'draft', id: 7, documentNumber: 'PAR/2026/0001' }),
          match({ key: 'draft-7-2', source: 'draft', id: 7, documentNumber: 'PAR/2026/0002' }),
        ])}
        draftId={42}
        itemId="row-a"
        paragonOfReadRow={onRowA}
        onMarkDuplicate={vi.fn()}
        renderRow={renderRow}
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

  it('keeps one hint per paragon when two merged into one row match the same transakcja', async () => {
    render(
      <Hints
        paragons={[
          { readRow: 0, description: 'Klej', amount: 89.9, matches: [match({})] },
          { readRow: 1, description: 'Fuga', amount: 45, matches: [match({})] },
        ]}
        draftId={42}
        itemId="row-a"
        paragonOfReadRow={onRowA}
        onMarkDuplicate={vi.fn()}
        renderRow={renderRow}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'OK, to nie duplikat' })).toHaveLength(2)

    await userEvent.setup().click(screen.getAllByRole('button', { name: 'OK, to nie duplikat' })[0])

    expect(screen.getAllByRole('button', { name: 'OK, to nie duplikat' })).toHaveLength(1)
  })

  it('names a match from this same zgłoszenie by its row, and drops it once that row is refused', () => {
    const twin = match({ key: 'draft-42-1', source: 'draft', id: 42, readRows: [1] })
    const hints = (twinStatus: ParagonRowT['status']) => (
      <Hints
        paragons={oneParagon([twin])}
        draftId={42}
        itemId="row-a"
        paragonOfReadRow={(readRow) =>
          readRow === 0
            ? { itemId: 'row-a', position: 0, status: 'pending' }
            : { itemId: 'row-b', position: 1, status: twinStatus }
        }
        onMarkDuplicate={vi.fn()}
        renderRow={renderRow}
      />
    )
    const { rerender } = render(hints('pending'))
    expect(screen.getByText('Pozycja 2 tego zgłoszenia')).toBeInTheDocument()

    rerender(hints('accepted'))
    expect(screen.getByText('Pozycja 2 tego zgłoszenia')).toBeInTheDocument()

    rerender(hints('rejected'))
    expect(screen.queryByText('Możliwe duplikaty')).toBeNull()
  })

  it('drops a match from this same zgłoszenie once a merge put both paragony in this row', () => {
    render(
      <Hints
        paragons={oneParagon([
          match({ key: 'draft-42-1', source: 'draft', id: 42, readRows: [1] }),
        ])}
        draftId={42}
        itemId="row-a"
        paragonOfReadRow={onRowA}
        onMarkDuplicate={vi.fn()}
        renderRow={renderRow}
      />,
    )

    expect(screen.queryByText('Możliwe duplikaty')).toBeNull()
  })

  it.each<[DuplicateHintsStateT, string]>([
    [{ status: 'reading' }, 'Odczytywanie paragonów — duplikaty sprawdzimy po odczycie.'],
    [{ status: 'checking' }, 'Sprawdzanie duplikatów…'],
    [{ status: 'no-read' }, 'Bez odczytu paragonów nie da się sprawdzić duplikatów.'],
    [{ status: 'error', retry: vi.fn() }, 'Nie udało się sprawdzić duplikatów.'],
  ])('shows the %o notice and offers no „Duplikat"', (state, notice) => {
    render(<ExpenseDraftDuplicateStatus state={state} />)

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
    paragons = oneParagon([match({ source: 'transaction', id: 501 })]),
  ) {
    const items = rows.map((row) => makeLineItem({ expenseCategory: '1', ...row }))
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
        wrapLineItem={({ itemId, markDuplicate, paragonOfReadRow, renderRow }) => (
          <Hints
            paragons={paragons}
            draftId={42}
            itemId={itemId}
            paragonOfReadRow={paragonOfReadRow}
            onMarkDuplicate={markDuplicate}
            renderRow={renderRow}
          />
        )}
      />,
    )
  }

  it('puts each paragon’s match inside its own row, above its fields, not beside the other paragon’s', async () => {
    renderAcceptance(
      [
        { description: 'Castorama 06.10.2026', amount: '107.4' },
        { description: 'Castorama 07.10.2026', amount: '117.4' },
      ],
      new Map(),
      [
        {
          readRow: 0,
          description: 'Castorama 06.10.2026',
          amount: 107.4,
          matches: [
            match({
              reasons: ['same-receipt'],
              key: 'transaction-5747',
              id: 5747,
              amount: 107.4,
              date: '2026-10-07',
              documentDate: null,
              description: 'Castorama 06.10.2026',
            }),
          ],
        },
        {
          readRow: 1,
          description: 'Castorama 07.10.2026',
          amount: 117.4,
          matches: [match({ key: 'transaction-5746', id: 5746, amount: 117.4 })],
        },
      ],
    )

    const [firstRow, secondRow] = await screen.findAllByRole('textbox', { name: 'Opis' })
    const firstHint = screen.getByText('Transakcja #5747').closest('section')!
    const secondHint = screen.getByText('Transakcja #5746').closest('section')!
    const isBefore = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(isBefore(firstHint, firstRow)).toBe(true)
    expect(isBefore(firstRow, secondHint)).toBe(true)
    expect(isBefore(secondHint, secondRow)).toBe(true)
    // Booked 07.10 before the printed-date column existed; matched on the 06.10 in its „Opis".
    expect(within(firstHint).getByText('06.10.2026')).toBeInTheDocument()
  })

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
    await user.click(screen.getByRole('button', { name: 'Połącz zaznaczone w 1 transakcję' }))
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
