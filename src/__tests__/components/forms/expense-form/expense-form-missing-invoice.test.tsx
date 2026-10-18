import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { expenseReferenceData, expenseValues } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => import('@/__tests__/stubs/ingest-files'))
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploadRows: (
    _rowCount: number,
    _files: Map<number, File[]>,
    submit: (rows: undefined) => Promise<unknown>,
  ) => submit(undefined),
}))

const row = (description: string) =>
  makeLineItem({ description, amount: '89.9', expenseCategory: '1', category: '1' })

const receipt = () => new File(['jpg'], 'faktura.jpg', { type: 'image/jpeg' })

function renderForm(values: BulkExpenseFormValuesT, files: Map<number, File[]>) {
  render(
    <ExpenseForm
      referenceData={expenseReferenceData}
      onSubmitSuccess={vi.fn()}
      formId="expense-draft-42"
      prefill={{
        expenseDraftId: 42,
        receipts: new Map(),
        aiReadRows: [],
        pagesByMediaId: new Map(),
        files,
        values,
      }}
    />,
  )
}

beforeEach(() => {
  useOptimisticFormStore.setState({ keepOpen: false })
})

describe('Wydatek inwestycyjny bez faktury', () => {
  it('pyta przed zapisem, a „Popraw" wraca do formularza bez wysyłki', async () => {
    renderForm(expenseValues({ lineItems: [row('Klej do płytek')] }), new Map())
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Zapisz' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Brak faktury')
    expect(dialog).toHaveTextContent('Ta pozycja nie ma załączonej faktury.')

    await user.click(screen.getByRole('button', { name: 'Popraw' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(createBulkTransferAction).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Klej do płytek')).toBeInTheDocument()
  })

  it('nazywa pozycje bez faktury i liczy je w partii', async () => {
    renderForm(
      expenseValues({ lineItems: [row('Klej do płytek'), row('Silikon'), row('')] }),
      new Map([[1, [receipt()]]]),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Zapisz' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Bez faktury: Klej do płytek, Pozycja 3 (2 z 3).',
    )
  })

  it('„Zapisz bez faktury" zapisuje raz', async () => {
    renderForm(
      expenseValues({
        type: 'INVESTMENT_EXPENSE_NET',
        lineItems: [{ ...row('Fuga'), netAmount: '73' }],
      }),
      new Map(),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Zapisz' }))
    await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
  })

  it('z fakturą przy każdej pozycji zapisuje bez pytania', async () => {
    renderForm(expenseValues({ lineItems: [row('Klej do płytek')] }), new Map([[0, [receipt()]]]))
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Odczyt paragonu w toku', () => {
  it('blokuje „Zapisz", dopóki skan nie wypełni pozycji, a potem zapisuje odczytane dane', async () => {
    let finishScan: (data: ReceiptFillResultT) => void = () => {}
    vi.mocked(scanReceiptClient).mockReturnValueOnce(
      new Promise((resolve) => {
        finishScan = resolve
      }),
    )
    renderForm(
      expenseValues({ lineItems: [row('Klej do płytek'), row('Silikon')] }),
      new Map([[0, [receipt()]]]),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Odczytaj ponownie' }))
    const save = screen.getByRole('button', { name: 'Zapisz' })
    await waitFor(() => expect(save).toBeDisabled())
    fireEvent.submit(save.closest('form')!)
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await act(async () => {
      finishScan({
        description: 'Klej Atlas',
        amount: 120,
        netAmount: 97.56,
        invoiceNote: '',
      } as ReceiptFillResultT)
    })
    await waitFor(() => expect(save).toBeEnabled())
    await user.click(save)
    await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createBulkTransferAction).mock.calls[0][0].lineItems[0]).toMatchObject({
      description: 'Klej Atlas',
      amount: 120,
    })
  })
})

describe('Inny wydatek bez faktury', () => {
  it('zapisuje bez pytania', async () => {
    renderForm(
      expenseValues({ type: 'OTHER', investment: '', lineItems: [row('Paliwo')] }),
      new Map(),
    )
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(createBulkTransferAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
