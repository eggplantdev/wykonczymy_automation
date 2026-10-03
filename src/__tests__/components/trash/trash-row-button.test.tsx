import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TrashRowButton } from '@/components/trash/trash-row-button'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const DESCRIPTION = 'Przenieść „WX 1000A" do kosza?'

const renderButton = (trash: () => Promise<ActionResultT>) =>
  render(
    <TrashRowButton
      label="Usuń pojazd"
      description={DESCRIPTION}
      trash={trash}
      trashed="Pojazd przeniesiony do kosza"
    />,
  )

const confirm = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Usuń pojazd' }))
  expect(await screen.findByText(DESCRIPTION)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Przenieś do kosza' }))
}

describe('TrashRowButton', () => {
  it('runs the action only after the confirm and reports success', async () => {
    const trash = vi.fn(async (): Promise<ActionResultT> => ({ success: true }))
    renderButton(trash)

    expect(trash).not.toHaveBeenCalled()
    await confirm()

    expect(trash).toHaveBeenCalledOnce()
    expect(toastMessage).toHaveBeenCalledWith('Pojazd przeniesiony do kosza', 'success')
  })

  it('shows the refusal the server gave', async () => {
    renderButton(async () => ({ success: false, error: 'Kasa ma saldo.' }))
    await confirm()
    expect(toastMessage).toHaveBeenCalledWith('Kasa ma saldo.', 'error')
  })
})
