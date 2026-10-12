import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EditTransferForm } from '@/components/forms/edit-transfer-form/edit-transfer-form'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'
import { transferRow } from '@/__tests__/fixtures/transfer-row'
import { updateTransferAction } from '@/lib/actions/transfers'
import type { TransferRowT } from '@/types/transfers'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/actions/transfers', () => ({
  updateTransferAction: vi.fn(async () => ({ success: true })),
  removeTransferInvoiceAction: vi.fn(),
  removeAllTransferInvoicesAction: vi.fn(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploads: (_files: File[], submit: (ids: number[]) => Promise<unknown>) => submit([]),
}))

const invoice = { id: 5, url: '/faktura.jpg', filename: 'faktura.jpg', mimeType: 'image/jpeg' }

const referenceData = {
  ...referenceDataFor('OWNER'),
  otherCategories: [{ id: 1, name: 'Paliwo' }],
} as unknown as ReturnType<typeof referenceDataFor>

function renderForm(row: TransferRowT) {
  render(<EditTransferForm row={row} referenceData={referenceData} onSubmitSuccess={vi.fn()} />)
}

beforeEach(() => vi.clearAllMocks())

describe('Edytuj transakcję — wydatek inwestycyjny bez faktury', () => {
  it('pyta przed zapisem, a „Popraw" nic nie wysyła', async () => {
    renderForm(transferRow({ description: 'Klej do płytek' }))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Ta transakcja nie ma załączonej faktury.',
    )
    await user.click(screen.getByRole('button', { name: 'Popraw' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(updateTransferAction).not.toHaveBeenCalled()
  })

  it('„Zapisz bez faktury" zapisuje', async () => {
    renderForm(transferRow({ type: 'INVESTMENT_EXPENSE_NET', description: 'Klej do płytek' }))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))
    await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))

    await waitFor(() => expect(updateTransferAction).toHaveBeenCalledTimes(1))
  })

  it('z fakturą zapisuje bez pytania', async () => {
    renderForm(transferRow({ description: 'Klej do płytek', invoices: [invoice] }))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(updateTransferAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('Edytuj transakcję — inny wydatek bez faktury', () => {
  it('zapisuje bez pytania', async () => {
    renderForm(transferRow({ type: 'OTHER', description: 'Paliwo', otherCategoryId: 1 }))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(updateTransferAction).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
