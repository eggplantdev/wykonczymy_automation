import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OrderDialog } from '@/components/orders/order-dialog'
import { expenseReferenceData } from '@/__tests__/helpers/expense-form'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'
import { formatPLN } from '@/lib/utils/format-currency'
import type { OrderSettingsT } from '@/types/order-settings'

vi.mocked(createBulkTransferAction).mockResolvedValue({ success: true })
vi.mocked(submitWithUploadRows).mockImplementation((_rowCount, _files, submit) =>
  submit(undefined as never),
)

const SITE_MANAGER_ID = 20

// `formatPLN` separates with a no-break space, which `toHaveTextContent` folds to a plain one.
const amount = (quantity: number, price: number) =>
  `${quantity} × ${formatPLN(price)} = ${formatPLN(quantity * price)}`.replace(/\s/g, ' ')

const referenceData = {
  ...expenseReferenceData,
  currentUserId: 1,
  workers: [
    { id: 1, name: 'Szef', role: 'OWNER', email: '', defaultCashRegisterId: 7 },
    { id: SITE_MANAGER_ID, name: 'Jan Kowalski', role: 'EMPLOYEE', email: '', phone: '601 234 567' },
  ],
  expenseCategories: [{ id: 5, name: 'Materiały budowlane' }],
  otherCategories: [{ id: 9, name: 'Big bag' }],
} as unknown as typeof expenseReferenceData

const SETTINGS: OrderSettingsT = {
  suppliers: [
    { id: 'supplier-alfa', name: 'Alfa Kontenery', phone: '601 000 001' },
    { id: 'supplier-beta', name: 'Beta Wywóz', phone: '601 000 002' },
  ],
  bigBagPrice: 800,
  containerPrice: 1500,
  defaultSupplierId: 'supplier-beta',
}

const INVESTMENT = {
  id: 3,
  street: 'ul. Polna 3',
  postalCode: '00-001',
  city: 'Warszawa',
  siteManagerId: SITE_MANAGER_ID,
}

function renderDialog(overrides: { settings?: OrderSettingsT; siteManagerId?: number } = {}) {
  render(
    <OrderDialog
      investment={{ ...INVESTMENT, siteManagerId: overrides.siteManagerId }}
      referenceData={referenceData}
      orderSettings={overrides.settings ?? SETTINGS}
      open
      onOpenChange={vi.fn()}
    />,
  )
  return userEvent.setup()
}

async function pickTwoBigBags(user: ReturnType<typeof userEvent.setup>) {
  const quantity = screen.getByLabelText('Ilość')
  await user.clear(quantity)
  await user.type(quantity, '2')
  await user.click(screen.getByRole('button', { name: 'Dalej' }))
}

async function bookAndReachSms(user: ReturnType<typeof userEvent.setup>) {
  await pickTwoBigBags(user)
  await user.click(await screen.findByRole('button', { name: 'Zapisz' }))
  await user.click(await screen.findByRole('button', { name: 'Zapisz bez faktury' }))
  return screen.findByRole('link', { name: 'Wyślij SMS' })
}

describe('OrderDialog', () => {
  it('recomputes the amount from the quantity and the kind', async () => {
    const user = renderDialog()

    await user.clear(screen.getByLabelText('Ilość'))
    await user.type(screen.getByLabelText('Ilość'), '3')
    expect(screen.getByText(/^Kwota:/)).toHaveTextContent(amount(3, 800))

    await user.click(screen.getByRole('radio', { name: 'kontener' }))
    expect(screen.getByText(/^Kwota:/)).toHaveTextContent(amount(3, 1500))
  })

  it('prefills the expense form with the order line and its amount', async () => {
    const user = renderDialog({ siteManagerId: SITE_MANAGER_ID })

    await pickTwoBigBags(user)

    expect(await screen.findByDisplayValue('2 × big bag')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1600')).toBeInTheDocument()
  })

  it('books with the order flag and opens the SMS to the default supplier', async () => {
    const user = renderDialog({ siteManagerId: SITE_MANAGER_ID })

    const send = await bookAndReachSms(user)

    expect(vi.mocked(createBulkTransferAction).mock.calls[0][3]).toEqual({ order: true })
    const href = send.getAttribute('href') ?? ''
    expect(href.startsWith('sms:601000002?&body=')).toBe(true)
    const body = decodeURIComponent(href.split('body=')[1])
    expect(body).toContain('2 × big bag')
    expect(body).toContain('Adres: ul. Polna 3, 00-001 Warszawa')
    expect(body).toContain('Kontakt na miejscu: Jan Kowalski, 601 234 567')
  })

  it('keeps only digits and a plus of a free-text supplier number', async () => {
    const user = renderDialog({
      settings: {
        ...SETTINGS,
        suppliers: [{ id: 'supplier-gamma', name: 'Gamma', phone: '+48 601-000-003 (Marek)' }],
        defaultSupplierId: 'supplier-gamma',
      },
      siteManagerId: SITE_MANAGER_ID,
    })

    const send = await bookAndReachSms(user)

    expect(send.getAttribute('href')).toMatch(/^sms:\+48601000003\?&body=/)
  })

  it('leaves the recipient empty when there are no suppliers', async () => {
    const user = renderDialog({
      settings: { ...SETTINGS, suppliers: [], defaultSupplierId: undefined },
      siteManagerId: SITE_MANAGER_ID,
    })

    const send = await bookAndReachSms(user)

    expect(send.getAttribute('href')).toMatch(/^sms:\?&body=/)
    expect(screen.getByText('Lista dostawców jest pusta — wpisz numer w telefonie.')).toBeInTheDocument()
  })

  it('warns and drops the contact line when the investment has no site manager', async () => {
    const user = renderDialog()

    const send = await bookAndReachSms(user)

    expect(
      screen.getByText('Inwestycja nie ma kierownika budowy — ustaw go na stronie inwestycji.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(decodeURIComponent(send.getAttribute('href') ?? '')).not.toContain('Kontakt na miejscu'),
    )
  })
})
