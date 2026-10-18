import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashInvestmentButton } from '@/components/investments/trash-investment-button'
import { trashInvestmentAction } from '@/lib/actions/investment-trash'
import { getInvestmentKosztorysUsed } from '@/lib/queries/investment-kosztorys-used'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'
import { toastMessage } from '@/lib/utils/toast'
import { router } from '@/__tests__/stubs/next-navigation'

async function openDialog() {
  render(
    <TrashInvestmentButton
      investment={{ id: 7, name: 'Mieszkanie Mokotów', status: 'completed', hasKosztorys: true }}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Usuń inwestycję' }))
}

async function confirmTrash() {
  await openDialog()
  await userEvent.click(await screen.findByRole('button', { name: 'Przenieś do kosza' }))
}

describe('TrashInvestmentButton', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getInvestmentKosztorysUsed).mockResolvedValue({ success: true, data: false })
  })

  it('warns that the kosztorys is in use before moving it to the trash', async () => {
    vi.mocked(getInvestmentKosztorysUsed).mockResolvedValue({ success: true, data: true })

    await openDialog()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain(KOSZTORYS_IN_USE_WARNING)
    expect(getInvestmentKosztorysUsed).toHaveBeenCalledWith(7)
  })

  it('asks without the warning when the kosztorys is not in use', async () => {
    await openDialog()

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).not.toContain(KOSZTORYS_IN_USE_WARNING)
  })

  it('opens no dialog when the kosztorys check fails', async () => {
    vi.mocked(getInvestmentKosztorysUsed).mockRejectedValue(new TypeError('Failed to fetch'))

    await openDialog()

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(trashInvestmentAction).not.toHaveBeenCalled()
  })

  it('reports a request that never reached the server (offline) with an error toast', async () => {
    vi.mocked(trashInvestmentAction).mockRejectedValue(new TypeError('Failed to fetch'))

    await confirmTrash()

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(toastMessage).not.toHaveBeenCalledWith(expect.anything(), 'success')
    expect(router.refresh).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
