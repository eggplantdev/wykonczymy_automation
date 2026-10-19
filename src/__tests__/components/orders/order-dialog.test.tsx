import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OrderDialog } from '@/components/orders/order-dialog'
import { expenseReferenceData } from '@/__tests__/helpers/expense-form'
import { setInvestmentSiteManagerAction } from '@/lib/actions/investments'
import { setDefaultSupplierAction } from '@/lib/actions/order-settings'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'
import { formatPLN } from '@/lib/utils/format-currency'
import { navigateTo } from '@/lib/utils/navigate-to'
import type { RoleT } from '@/lib/auth/roles'
import type { OrderSettingsT } from '@/types/order-settings'

vi.mocked(createBulkTransferAction).mockResolvedValue({ success: true })
vi.mocked(submitWithUploadRows).mockImplementation((_rowCount, _files, submit) =>
  submit(undefined as never),
)
vi.mocked(navigateTo).mockImplementation(() => {})

const SITE_MANAGER_ID = 20

// `formatPLN` separates with a no-break space, which `toHaveTextContent` folds to a plain one.
const amount = (quantity: number, price: number) =>
  `${quantity} × ${formatPLN(price)} = ${formatPLN(quantity * price)}`.replace(/\s/g, ' ')

const referenceData = {
  ...expenseReferenceData,
  currentUserId: 1,
  workers: [
    { id: 1, name: 'Szef', role: 'OWNER', email: '', defaultCashRegisterId: 7 },
    {
      id: SITE_MANAGER_ID,
      name: 'Jan Kowalski',
      role: 'EMPLOYEE',
      email: '',
      phone: '601 234 567',
    },
    { id: 21, name: 'Anna Nowak', role: 'EMPLOYEE', email: '', phone: '602 345 678' },
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
  name: 'Polna 3',
  street: 'ul. Polna 3',
  postalCode: '00-001',
  city: 'Warszawa',
  siteManagerId: SITE_MANAGER_ID,
}

function dialogFor(
  overrides: {
    settings?: OrderSettingsT
    siteManagerId?: number
    role?: RoleT
    onOpenChange?: (open: boolean) => void
  } = {},
) {
  return (
    <OrderDialog
      investment={{ ...INVESTMENT, siteManagerId: overrides.siteManagerId }}
      referenceData={{ ...referenceData, currentUserRole: overrides.role ?? 'OWNER' }}
      orderSettings={overrides.settings ?? SETTINGS}
      open
      onOpenChange={overrides.onOpenChange ?? vi.fn()}
    />
  )
}

function renderDialog(overrides: Parameters<typeof dialogFor>[0] = {}) {
  render(dialogFor(overrides))
  return userEvent.setup()
}

async function pickTwoBigBags(user: ReturnType<typeof userEvent.setup>) {
  const quantity = screen.getByLabelText('Ilość')
  await user.clear(quantity)
  await user.type(quantity, '2')
  await user.click(screen.getByRole('button', { name: 'Dalej' }))
}

async function bookAndOpenSms(user: ReturnType<typeof userEvent.setup>) {
  await pickTwoBigBags(user)
  await user.click(await screen.findByRole('button', { name: 'Zapisz' }))
  await waitFor(() => expect(navigateTo).toHaveBeenCalledOnce())
  return vi.mocked(navigateTo).mock.calls[0][0]
}

const smsBody = (href: string) => decodeURIComponent(href.split('body=')[1])

describe('OrderDialog', () => {
  it('recomputes the amount from the quantity and the kind', async () => {
    const user = renderDialog()

    await user.clear(screen.getByLabelText('Ilość'))
    await user.type(screen.getByLabelText('Ilość'), '3')
    expect(screen.getByText(/^Kwota:/)).toHaveTextContent(amount(3, 800))

    await user.click(screen.getByRole('radio', { name: 'kontener' }))
    expect(screen.getByText(/^Kwota:/)).toHaveTextContent(amount(3, 1500))
  })

  it('books the amount from a price edited for this order', async () => {
    const user = renderDialog()

    await user.clear(screen.getByLabelText('Cena za sztukę (zł)'))
    await user.type(screen.getByLabelText('Cena za sztukę (zł)'), '750,5')
    await pickTwoBigBags(user)

    expect(await screen.findByDisplayValue('1501')).toBeInTheDocument()
  })

  it('rejects a price that is not a plain amount in grosze', async () => {
    const user = renderDialog()
    const price = screen.getByLabelText('Cena za sztukę (zł)')

    for (const text of ['0x10', '1e3', '0,001']) {
      await user.clear(price)
      await user.type(price, text)
      expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled()
    }
  })

  it('takes a price saved from the gear without losing the quantity', async () => {
    const view = render(dialogFor())
    const user = userEvent.setup()

    await user.clear(screen.getByLabelText('Ilość'))
    await user.type(screen.getByLabelText('Ilość'), '3')
    view.rerender(dialogFor({ settings: { ...SETTINGS, bigBagPrice: 900 } }))

    expect(screen.getByLabelText('Cena za sztukę (zł)')).toHaveValue('900')
    expect(screen.getByLabelText('Ilość')).toHaveValue('3')
  })

  it('resets the price to the setting when the kind changes', async () => {
    const user = renderDialog()

    await user.clear(screen.getByLabelText('Cena za sztukę (zł)'))
    await user.type(screen.getByLabelText('Cena za sztukę (zł)'), '650')
    await user.click(screen.getByRole('radio', { name: 'kontener' }))

    expect(screen.getByLabelText('Cena za sztukę (zł)')).toHaveValue('1500')
  })

  it('prefills the expense form with the order line and its amount', async () => {
    const user = renderDialog({ siteManagerId: SITE_MANAGER_ID })

    await pickTwoBigBags(user)

    expect(await screen.findByDisplayValue('2 × big bag')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1600')).toBeInTheDocument()
  })

  it('books with the order flag, opens the SMS to the default supplier and closes', async () => {
    const onOpenChange = vi.fn()
    const user = renderDialog({ siteManagerId: SITE_MANAGER_ID, onOpenChange })

    const href = await bookAndOpenSms(user)

    expect(vi.mocked(createBulkTransferAction).mock.calls[0][3]).toEqual({ order: true })
    expect(href.startsWith('sms:601000002?&body=')).toBe(true)
    expect(smsBody(href)).toContain('2 × big bag')
    expect(smsBody(href)).toContain('Adres: ul. Polna 3, 00-001 Warszawa')
    expect(smsBody(href)).toContain('Kontakt na miejscu: Jan Kowalski, 601 234 567')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('sends the SMS to the supplier picked in the first step', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('combobox', { name: 'Dostawca' }))
    await user.click(await screen.findByRole('option', { name: 'Alfa Kontenery · 601 000 001' }))
    const href = await bookAndOpenSms(user)

    expect(href.startsWith('sms:601000001?&body=')).toBe(true)
  })

  it('saves the picked supplier as the default', async () => {
    vi.mocked(setDefaultSupplierAction).mockResolvedValue({ success: true })
    const user = renderDialog()

    await user.click(screen.getByRole('combobox', { name: 'Dostawca' }))
    await user.click(await screen.findByRole('option', { name: 'Alfa Kontenery · 601 000 001' }))
    await user.click(screen.getByRole('button', { name: 'Zapisz jako domyślnego dostawcę' }))

    expect(setDefaultSupplierAction).toHaveBeenCalledWith('supplier-alfa')
    expect(await screen.findByRole('button', { name: 'Dostawca domyślny' })).toBeDisabled()
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

    expect(await bookAndOpenSms(user)).toMatch(/^sms:\+48601000003\?&body=/)
  })

  it('leaves the recipient empty when there are no suppliers', async () => {
    const user = renderDialog({
      settings: { ...SETTINGS, suppliers: [], defaultSupplierId: undefined },
      siteManagerId: SITE_MANAGER_ID,
    })

    expect(
      screen.getByText('Lista dostawców jest pusta — numer wpiszesz w telefonie.'),
    ).toBeInTheDocument()
    expect(await bookAndOpenSms(user)).toMatch(/^sms:\?&body=/)
  })

  it('puts the contact picked in the first step into the SMS', async () => {
    const user = renderDialog({ siteManagerId: SITE_MANAGER_ID })

    await user.click(screen.getByRole('combobox', { name: 'Kontakt na miejscu' }))
    await user.click(await screen.findByRole('option', { name: 'Anna Nowak · 602 345 678' }))

    expect(smsBody(await bookAndOpenSms(user))).toContain(
      'Kontakt na miejscu: Anna Nowak, 602 345 678',
    )
  })

  it('sets the picked contact as the site manager', async () => {
    vi.mocked(setInvestmentSiteManagerAction).mockResolvedValue({ success: true })
    const user = renderDialog()

    await user.click(screen.getByRole('combobox', { name: 'Kontakt na miejscu' }))
    await user.click(await screen.findByRole('option', { name: 'Jan Kowalski · 601 234 567' }))
    await user.click(screen.getByRole('button', { name: 'Ustaw jako kierownika budowy' }))

    expect(setInvestmentSiteManagerAction).toHaveBeenCalledWith(INVESTMENT.id, SITE_MANAGER_ID)
    expect(await screen.findByRole('button', { name: 'Kierownik budowy' })).toBeDisabled()
  })

  it('drops the contact line when the investment has no site manager', async () => {
    const user = renderDialog()

    expect(smsBody(await bookAndOpenSms(user))).not.toContain('Kontakt na miejscu')
  })

  it('opens the order settings from the gear for an owner only', async () => {
    const user = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Ustawienia zamówień' }))
    expect(await screen.findByRole('dialog', { name: 'Ustawienia zamówień' })).toBeInTheDocument()
  })

  it('hides the gear from a manager', () => {
    renderDialog({ role: 'MANAGER' })

    expect(screen.queryByRole('button', { name: 'Ustawienia zamówień' })).not.toBeInTheDocument()
  })
})
