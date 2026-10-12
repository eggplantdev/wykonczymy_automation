import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))

const { sendExpenseDraftAction } = vi.hoisted(() => ({ sendExpenseDraftAction: vi.fn() }))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({ sendExpenseDraftAction }))
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploads: (_files: File[], action: (mediaIds: number[]) => unknown) => action([11]),
}))
vi.mock('@/lib/media/ingest-picked-files', () => ({
  ingestPickedFiles: async (files: File[]) => ({ files, blocked: [] }),
}))

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów' }] as WorkerStageInvestmentT[]
const TWO_INVESTMENTS = [
  ...INVESTMENTS,
  { investmentId: 2, name: 'Wola' },
] as WorkerStageInvestmentT[]
const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

async function openInvestmentSelect() {
  await userEvent.click(screen.getByRole('combobox'))
}

beforeEach(() => {
  sendExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
})

describe('ExpenseDraftDialog „Bez inwestycji”', () => {
  it('offers it beside the investments to a flagged worker, picking neither', async () => {
    render(
      <ExpenseDraftDialog investments={TWO_INVESTMENTS} registers={REGISTERS} canSkipInvestment />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Wybierz inwestycję')
    await openInvestmentSelect()
    expect(screen.getByRole('option', { name: 'Bez inwestycji' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mokotów' })).toBeInTheDocument()
  })

  it('does not offer it to an unflagged worker', async () => {
    render(
      <ExpenseDraftDialog
        investments={TWO_INVESTMENTS}
        registers={REGISTERS}
        canSkipInvestment={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
    await openInvestmentSelect()

    expect(screen.queryByRole('option', { name: 'Bez inwestycji' })).not.toBeInTheDocument()
  })

  it('pre-selects it for a flagged worker with no investment and sends null', async () => {
    render(<ExpenseDraftDialog investments={[]} registers={REGISTERS} canSkipInvestment />)
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Bez inwestycji')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ investmentId: null, cashRegisterId: 3 }),
      ),
    )
  })

  it('drops the pick kept from the last send once the flag is cleared', async () => {
    const { rerender } = render(
      <ExpenseDraftDialog investments={TWO_INVESTMENTS} registers={REGISTERS} canSkipInvestment />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
    await openInvestmentSelect()
    await userEvent.click(screen.getByRole('option', { name: 'Bez inwestycji' }))
    await userEvent.keyboard('{Escape}')

    rerender(
      <ExpenseDraftDialog
        investments={TWO_INVESTMENTS}
        registers={REGISTERS}
        canSkipInvestment={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, new File(['x'], 'p.jpg', { type: 'image/jpeg' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Wybierz inwestycję')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })

  it('drops a kasa kept from the last send once it is gone', async () => {
    const twoRegisters = [
      { id: 3, name: 'Kasa Jana', active: true },
      { id: 4, name: 'Kasa druga', active: true },
    ] as never
    const { rerender } = render(
      <ExpenseDraftDialog
        investments={INVESTMENTS}
        registers={twoRegisters}
        canSkipInvestment={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
    await userEvent.click(screen.getAllByRole('combobox')[1]!)
    await userEvent.click(screen.getByRole('option', { name: 'Kasa druga' }))
    await userEvent.keyboard('{Escape}')

    rerender(
      <ExpenseDraftDialog
        investments={INVESTMENTS}
        registers={REGISTERS}
        canSkipInvestment={false}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await userEvent.upload(input, new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ cashRegisterId: 3 }),
      ),
    )
  })
})
