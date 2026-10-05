import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import type { PreviewFileT } from '@/types/media'
import type { RoleT } from '@/lib/auth/roles'

const removeTransferInvoiceAction = vi.fn()
vi.mock('@/lib/actions/transfers', () => ({
  removeTransferInvoiceAction: (...args: unknown[]) => removeTransferInvoiceAction(...args),
  removeAllTransferInvoicesAction: vi.fn(),
}))

vi.mock('@/hooks/use-invoice-upload', () => ({
  useInvoiceUpload: () => ({ isUploading: false, uploadFiles: vi.fn() }),
}))

const currentUser = vi.hoisted(() => ({ role: 'OWNER' as RoleT }))
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 1, role: currentUser.role }),
}))

const PAGE_ONE: PreviewFileT = {
  id: 11,
  url: '/api/media/file/faktura-1.jpg',
  filename: 'faktura-1.jpg',
  mimeType: 'image/jpeg',
}
const PAGE_TWO: PreviewFileT = {
  id: 12,
  url: '/api/media/file/faktura-2.jpg',
  filename: 'faktura-2.jpg',
  mimeType: 'image/jpeg',
}

// The label sets moved out of the dialog into shared presets, so the invoice surface — which passes
// none of them and rides on the defaults — is where a wrong default would surface as „plik" wording.
describe('InvoiceCell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser.role = 'OWNER'
  })

  // Risk #22: the worker reads his own transfers' faktury, but the upload/removal actions refuse him.
  it('shows an EMPLOYEE the preview without any way to add or remove a faktura', async () => {
    const user = userEvent.setup()
    currentUser.role = 'EMPLOYEE'
    render(<InvoiceCell transactionId={3} invoices={[PAGE_ONE]} />)

    expect(screen.queryByRole('button', { name: /Dodaj fakturę/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Podgląd/ }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).queryByRole('button', { name: 'Usuń stronę' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Dodaj stronę' })).not.toBeInTheDocument()
  })

  it('keeps the faktura wording in the preview', async () => {
    const user = userEvent.setup()
    render(<InvoiceCell transactionId={3} invoices={[PAGE_ONE, PAGE_TWO]} />)

    await user.click(screen.getByRole('button', { name: /^Podgląd/ }))
    const dialog = screen.getByRole('dialog')

    expect(within(dialog).getByRole('button', { name: 'Usuń stronę' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Usuń całą fakturę' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Dodaj stronę' })).toBeInTheDocument()
  })

  it('asks before removing a page and warns the file is gone for good', async () => {
    const user = userEvent.setup()
    removeTransferInvoiceAction.mockResolvedValue({ success: true })
    render(<InvoiceCell transactionId={3} invoices={[PAGE_ONE, PAGE_TWO]} />)

    await user.click(screen.getByRole('button', { name: /^Podgląd/ }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Usuń stronę' }),
    )

    expect(screen.getByText('Czy na pewno chcesz usunąć tę stronę?')).toBeInTheDocument()
    expect(screen.getByText(/bezpowrotnie/)).toBeInTheDocument()
    expect(removeTransferInvoiceAction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Usuń' }))
    expect(removeTransferInvoiceAction).toHaveBeenCalledWith(3, PAGE_ONE.id)
  })
})
