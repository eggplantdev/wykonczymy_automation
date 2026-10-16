import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))
vi.mock('@/lib/media/ingest-files', () => ({
  ingestFiles: async (picked: File[]) => ({ processed: picked, blocked: [] }),
}))
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
  vi.clearAllMocks()
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
