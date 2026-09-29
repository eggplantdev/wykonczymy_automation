import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DiscountAmountPairField } from '@/components/kosztorys/summary/settings/discount-amount-pair-field'
import { discountNetFromGross } from '@/lib/kosztorys/calc'

const onApply = vi.fn()

function renderField(value = 0, vatRate = 0.08) {
  const view = render(<DiscountAmountPairField value={value} vatRate={vatRate} onApply={onApply} />)
  return {
    ...view,
    user: userEvent.setup(),
    net: screen.getByLabelText(/netto/) as HTMLInputElement,
    gross: screen.getByLabelText(/brutto/) as HTMLInputElement,
    save: screen.getByRole('button', { name: 'Zapisz' }),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('Rabat kwotowy — pola netto i brutto', () => {
  // EX-933: on a brutto deal the owner typed 5000 meaning 5000 zł off, and got 5400.
  it('5000 wpisane w brutto przy 8% pokazuje netto przed zapisem i zapisuje jego netto', async () => {
    const { user, net, gross, save } = renderField()

    await user.clear(gross)
    await user.type(gross, '5000')

    expect(net).toHaveValue('4629,63')
    expect(onApply).not.toHaveBeenCalled()

    await user.click(save)
    expect(onApply).toHaveBeenCalledWith(discountNetFromGross(5000, 0.08))
  })

  it('kwota wpisana w netto pokazuje brutto i zapisuje się bez przeliczenia', async () => {
    const { user, net, gross, save } = renderField()

    await user.clear(net)
    await user.type(net, '1000')

    expect(gross).toHaveValue('1080')
    await user.click(save)
    expect(onApply).toHaveBeenCalledWith(1000)
  })

  it('kwota wpisana w netto zapisuje się w groszach', async () => {
    const { user, net, save } = renderField()

    await user.clear(net)
    await user.type(net, '1000,006')
    await user.click(save)

    expect(onApply).toHaveBeenCalledWith(1000.01)
  })

  it('„Zapisz" nie reaguje na tę samą kwotę wpisaną z przecinkiem', async () => {
    const { user, net, save } = renderField(1000.5)

    expect(net).toHaveValue('1000,5')
    await user.clear(net)
    await user.type(net, '1000,5')
    expect(save).toBeDisabled()
  })

  it('Enter zapisuje, wyjście z pola nie', async () => {
    const { user, gross } = renderField()

    await user.clear(gross)
    await user.type(gross, '540')
    await user.tab()
    expect(onApply).not.toHaveBeenCalled()

    await user.click(gross)
    await user.keyboard('{Enter}')
    expect(onApply).toHaveBeenCalledWith(discountNetFromGross(540, 0.08))
  })

  it('„Zapisz" jest nieaktywne, dopóki nic się nie zmieniło', async () => {
    const { user, gross, save } = renderField(1000)

    expect(save).toBeDisabled()
    await user.clear(gross)
    await user.type(gross, '1080')
    expect(save).toBeDisabled()
  })

  it('niepełny wpis czyści drugie pole zamiast pokazać NaN', async () => {
    const { user, net, gross, save } = renderField(1000)

    await user.clear(gross)
    await user.type(gross, '-')

    expect(net).toHaveValue('')
    expect(save).toBeDisabled()
  })

  it('nowa zapisana kwota albo nowa stawka VAT odświeża oba pola', async () => {
    const { user, net, gross, rerender } = renderField(1000)

    await user.clear(gross)
    await user.type(gross, '99')

    rerender(<DiscountAmountPairField value={2000} vatRate={0.08} onApply={onApply} />)
    expect(net).toHaveValue('2000')
    expect(gross).toHaveValue('2160')

    rerender(<DiscountAmountPairField value={2000} vatRate={0.23} onApply={onApply} />)
    expect(net).toHaveValue('2000')
    expect(gross).toHaveValue('2460')
  })
})
