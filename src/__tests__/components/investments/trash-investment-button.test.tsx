import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashInvestmentButton } from '@/components/investments/trash-investment-button'

const refresh = vi.fn()
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh }),
}))

const trashInvestmentAction = vi.fn()
vi.mock('@/lib/actions/investment-trash', () => ({
  trashInvestmentAction: (...args: unknown[]) => trashInvestmentAction(...args),
}))

const toastMessage = vi.fn()
vi.mock('@/lib/utils/toast', () => ({
  toastMessage: (...args: unknown[]) => toastMessage(...args),
}))

async function confirmTrash() {
  render(<TrashInvestmentButton investment={{ id: 7, name: 'Mieszkanie Mokotów' }} />)
  await userEvent.click(screen.getByRole('button', { name: 'Usuń inwestycję' }))
  await userEvent.click(screen.getByRole('button', { name: 'Przenieś do kosza' }))
}

describe('TrashInvestmentButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
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
