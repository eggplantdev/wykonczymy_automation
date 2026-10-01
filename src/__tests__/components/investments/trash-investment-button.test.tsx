import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashInvestmentButton } from '@/components/investments/trash-investment-button'
import { KOSZTORYS_IN_USE_WARNING } from '@/lib/constants/trash'

const refresh = vi.fn()
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh }),
}))

const trashInvestmentAction = vi.fn()
vi.mock('@/lib/actions/investment-trash', () => ({
  trashInvestmentAction: (...args: unknown[]) => trashInvestmentAction(...args),
}))

const getInvestmentKosztorysUsed = vi.fn()
vi.mock('@/lib/queries/investment-kosztorys-used', () => ({
  getInvestmentKosztorysUsed: (...args: unknown[]) => getInvestmentKosztorysUsed(...args),
}))

const toastMessage = vi.fn()
vi.mock('@/lib/utils/toast', () => ({
  toastMessage: (...args: unknown[]) => toastMessage(...args),
}))

async function openDialog() {
  render(<TrashInvestmentButton investment={{ id: 7, name: 'Mieszkanie Mokotów' }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Usuń inwestycję' }))
}

async function confirmTrash() {
  await openDialog()
  await userEvent.click(await screen.findByRole('button', { name: 'Przenieś do kosza' }))
}

describe('TrashInvestmentButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getInvestmentKosztorysUsed.mockResolvedValue(false)
  })

  it('warns that the kosztorys is in use before moving it to the trash', async () => {
    getInvestmentKosztorysUsed.mockResolvedValue(true)

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
    getInvestmentKosztorysUsed.mockRejectedValue(new TypeError('Failed to fetch'))

    await openDialog()

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(trashInvestmentAction).not.toHaveBeenCalled()
  })

  it('reports a request that never reached the server (offline) with an error toast', async () => {
    trashInvestmentAction.mockRejectedValue(new TypeError('Failed to fetch'))

    await confirmTrash()

    await waitFor(() => expect(toastMessage).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(toastMessage).not.toHaveBeenCalledWith(expect.anything(), 'success')
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
