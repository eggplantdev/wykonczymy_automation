import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { makeLineItem } from '@/components/forms/expense-form/bulk-expense-form'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import { useExpenseFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'
import { scanReceiptClient } from '@/lib/utils/scan-receipt-client'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))
vi.mock('@/lib/actions/transfers', () => ({
  createBulkTransferAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/utils/scan-receipt-client', () => ({ scanReceiptClient: vi.fn() }))

const referenceData = {
  ...referenceDataFor('OWNER'),
  cashRegisters: [
    { id: 1, name: 'Kasa główna', type: 'MAIN' as const },
    { id: 7, name: 'Kasa Jana', type: 'AUXILIARY' as const },
  ],
  investments: [{ id: 3, name: 'Mieszkanie Mokotów', status: 'active' as const }],
} as unknown as ReturnType<typeof referenceDataFor>

function valuesWith(overrides: Partial<BulkExpenseFormValuesT>): BulkExpenseFormValuesT {
  return {
    date: '2026-10-05',
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: 'CASH',
    sourceRegister: '',
    targetRegister: '',
    investment: '',
    worker: '',
    settled: false,
    lineItems: [makeLineItem({ description: '' })],
    ...overrides,
  }
}

const halfTypedExpense = valuesWith({
  lineItems: [makeLineItem({ description: 'Kleje z Castoramy', amount: '120' })],
})

beforeEach(() => {
  vi.clearAllMocks()
  useExpenseFormStore.getState().updateFormData('expense', halfTypedExpense)
  useOptimisticFormStore.setState({ keepOpen: false })
})

describe('Wydatek ze zgłoszenia pracownika', () => {
  it('startuje z inwestycji, kasy i zdjęć zgłoszenia, a niedokończony „Nowy wydatek" zostaje', async () => {
    const receipt = new File(['jpg'], 'paragon-leroy.jpg', { type: 'image/jpeg' })

    render(
      <ExpenseForm
        referenceData={referenceData}
        onSubmitSuccess={vi.fn()}
        formId="expense-draft-42"
        prefill={{
          expenseDraftId: 42,
          files: new Map([[0, [receipt]]]),
          values: valuesWith({ investment: '3', sourceRegister: '7' }),
        }}
      />,
    )

    expect(await screen.findByText('Mieszkanie Mokotów')).toBeInTheDocument()
    expect(screen.getByText('Kasa Jana')).toBeInTheDocument()
    expect(screen.getByText('paragon-leroy.jpg')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Kleje z Castoramy')).toBeNull()

    await userEvent.setup().type(screen.getByRole('textbox', { name: 'Opis' }), 'Fugi')
    // The store listener is debounced 500 ms; give it the chance to (wrongly) write.
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(useExpenseFormStore.getState()).toMatchObject({
      formId: 'expense',
      formData: halfTypedExpense,
    })
  })

  it('wiersz odczytany przy wysyłce otwiera się wypełniony, bez przycisku i bez skanu', async () => {
    const receipt = new File(['jpg'], 'leroy.jpg', { type: 'image/jpeg' })

    render(
      <ExpenseForm
        referenceData={referenceData}
        onSubmitSuccess={vi.fn()}
        formId="expense-draft-42"
        prefill={{
          expenseDraftId: 42,
          files: new Map([[0, [receipt]]]),
          values: valuesWith({
            investment: '3',
            sourceRegister: '7',
            lineItems: [makeLineItem({ description: 'Klej do płytek', amount: '89.9' })],
          }),
        }}
      />,
    )

    expect(await screen.findByDisplayValue('Klej do płytek')).toBeInTheDocument()
    expect(screen.getByDisplayValue('89.9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Odczytaj dodane zdjęcia' })).toBeNull()
    expect(scanReceiptClient).not.toHaveBeenCalled()
  })

  it('pusty wiersz ze zdjęciami czeka na „Odczytaj dodane zdjęcia" i odczytuje je po kliknięciu', async () => {
    vi.mocked(scanReceiptClient).mockResolvedValue({
      description: 'Klej do płytek',
      amount: 89.9,
      netAmount: 73.09,
      invoiceNote: '',
    } as ReceiptFillResultT)
    const pages = [
      new File(['jpg'], 'strona-1.jpg', { type: 'image/jpeg' }),
      new File(['jpg'], 'strona-2.jpg', { type: 'image/jpeg' }),
    ]

    render(
      <ExpenseForm
        referenceData={referenceData}
        onSubmitSuccess={vi.fn()}
        formId="expense-draft-42"
        prefill={{
          expenseDraftId: 42,
          files: new Map([[0, pages]]),
          values: valuesWith({ investment: '3', sourceRegister: '7' }),
        }}
      />,
    )

    const button = await screen.findByRole('button', { name: 'Odczytaj dodane zdjęcia' })
    expect(scanReceiptClient).not.toHaveBeenCalled()
    await userEvent.setup().click(button)

    expect(await screen.findByDisplayValue('Klej do płytek')).toBeInTheDocument()
    expect(scanReceiptClient).toHaveBeenCalledTimes(1)
    expect(vi.mocked(scanReceiptClient).mock.calls[0][0]).toEqual(pages)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Odczytaj dodane zdjęcia' })).toBeNull(),
    )
  })

  it('bez zgłoszenia „Nowy wydatek" odtwarza swój szkic', async () => {
    render(<ExpenseForm referenceData={referenceData} onSubmitSuccess={vi.fn()} />)

    expect(await screen.findByDisplayValue('Kleje z Castoramy')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument()
  })
})
