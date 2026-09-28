import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MaterialsNetPricingControl } from '@/components/kosztorys/summary/materials-net-pricing-control'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const onMaterialsNetRateChange = vi.fn()

function renderControl() {
  render(
    <MaterialsNetPricingControl
      vatRate={0.23}
      materialsNetRate={0.23}
      onMaterialsNetRateChange={onMaterialsNetRateChange}
    />,
  )
  return {
    user: userEvent.setup(),
    input: screen.getByRole('textbox') as HTMLInputElement,
    save: screen.getByRole('button', { name: 'Zapisz' }),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('Stawka vat na materiały — wartość spoza 0–100%', () => {
  // EX-819: „230" zamiast „23" zapisywało po cichu 100% i przeliczało całe materiały.
  it('odmawia 230%, mówi o tym i zostawia zapisaną stawkę', async () => {
    const { user, input, save } = renderControl()

    await user.clear(input)
    await user.type(input, '230')
    await user.click(save)

    expect(onMaterialsNetRateChange).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledWith(
      'Nieprawidłowa wartość — przywrócono 23%.',
      'error',
      expect.any(Number),
    )
    expect(screen.getByRole('textbox')).toHaveValue('23')
  })

  it('odmawia też przez Enter', async () => {
    const { user, input } = renderControl()

    await user.clear(input)
    await user.type(input, '230{Enter}')

    expect(onMaterialsNetRateChange).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledTimes(1)
  })

  it('zapisuje stawkę w zakresie bez słowa', async () => {
    const { user, input, save } = renderControl()

    await user.clear(input)
    await user.type(input, '8')
    await user.click(save)

    expect(onMaterialsNetRateChange).toHaveBeenCalledWith(0.08)
    expect(toastMessage).not.toHaveBeenCalled()
  })
})
