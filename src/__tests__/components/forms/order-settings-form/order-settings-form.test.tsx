import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OrderSettingsForm } from '@/components/forms/order-settings-form/order-settings-form'
import { saveOrderSettingsAction } from '@/lib/actions/order-settings'

const SETTINGS = {
  suppliers: [
    { id: 'supplier-alfa', name: 'Alfa Kontenery', phone: '601 000 001' },
    { id: 'supplier-beta', name: 'Beta Wywóz', phone: '601 000 002' },
  ],
  bigBagPrice: 800,
  containerPrice: 1500,
  defaultBigBagSupplierId: 'supplier-alfa',
  defaultContainerSupplierId: undefined,
}

function renderForm() {
  vi.mocked(saveOrderSettingsAction).mockResolvedValue({ success: true })
  render(
    <OrderSettingsForm formId="order-settings" settings={SETTINGS} onSubmitSuccess={vi.fn()} />,
  )
  return userEvent.setup()
}

const submitted = async () => {
  await waitFor(() => expect(saveOrderSettingsAction).toHaveBeenCalledTimes(1))
  return vi.mocked(saveOrderSettingsAction).mock.calls[0][0]
}

describe('OrderSettingsForm', () => {
  it('sends existing rows with their ids, an edited name and a new price', async () => {
    const user = renderForm()

    const [firstName] = screen.getAllByPlaceholderText('Nazwa')
    await user.clear(firstName)
    await user.type(firstName, '  Alfa Plus  ')
    const bigBagPrice = screen.getByLabelText('Cena big bag (zł)')
    await user.clear(bigBagPrice)
    await user.type(bigBagPrice, '900')
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(await submitted()).toEqual({
      suppliers: [
        { id: 'supplier-alfa', name: 'Alfa Plus', phone: '601 000 001' },
        { id: 'supplier-beta', name: 'Beta Wywóz', phone: '601 000 002' },
      ],
      bigBagPrice: 900,
      containerPrice: 1500,
      defaultBigBagSupplierId: 'supplier-alfa',
      defaultContainerSupplierId: undefined,
    })
  })

  it('shows each kind default and sends a newly picked container default', async () => {
    const user = renderForm()

    expect(screen.getByRole('combobox', { name: 'Domyślny dostawca big bag' })).toHaveTextContent(
      'Alfa Kontenery',
    )
    expect(screen.getByRole('combobox', { name: 'Domyślny dostawca kontenera' })).toHaveTextContent(
      '— brak —',
    )
    await user.click(screen.getByRole('combobox', { name: 'Domyślny dostawca kontenera' }))
    await user.click(await screen.findByRole('option', { name: 'Beta Wywóz' }))
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    const data = await submitted()
    expect(data.defaultBigBagSupplierId).toBe('supplier-alfa')
    expect(data.defaultContainerSupplierId).toBe('supplier-beta')
  })

  it('clears a default whose supplier row is removed', async () => {
    const user = renderForm()

    await user.click(screen.getAllByRole('button', { name: 'Usuń dostawcę' })[0])

    expect(screen.getByRole('combobox', { name: 'Domyślny dostawca big bag' })).toHaveTextContent(
      '— brak —',
    )
  })

  it('drops a removed row and sends an added one', async () => {
    const user = renderForm()

    await user.click(screen.getAllByRole('button', { name: 'Usuń dostawcę' })[0])
    await user.click(screen.getByRole('button', { name: 'Dodaj dostawcę' }))
    const names = screen.getAllByPlaceholderText('Nazwa')
    const phones = screen.getAllByPlaceholderText('601 234 567')
    await user.type(names[1], 'Gamma')
    await user.type(phones[1], '601 000 003')
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    const data = await submitted()
    expect(data.suppliers.map(({ name, phone }) => ({ name, phone }))).toEqual([
      { name: 'Beta Wywóz', phone: '601 000 002' },
      { name: 'Gamma', phone: '601 000 003' },
    ])
    expect(data.suppliers[0].id).toBe('supplier-beta')
    expect(data.suppliers[1].id).toEqual(expect.any(String))
  })

  it('blocks a row with no phone', async () => {
    const user = renderForm()

    await user.click(screen.getByRole('button', { name: 'Dodaj dostawcę' }))
    await user.type(screen.getAllByPlaceholderText('Nazwa')[2], 'Gamma')
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(await screen.findByText('Telefon jest wymagany')).toBeInTheDocument()
    expect(saveOrderSettingsAction).not.toHaveBeenCalled()
  })
})
