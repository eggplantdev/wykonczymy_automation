import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseDraftDialog } from '@/components/worker-expenses/expense-draft-dialog'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn() }),
}))

const { sendExpenseDraftAction, updateExpenseDraftAction } = vi.hoisted(() => ({
  sendExpenseDraftAction: vi.fn(),
  updateExpenseDraftAction: vi.fn(),
}))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  sendExpenseDraftAction,
  updateExpenseDraftAction,
}))
vi.mock('@/lib/media/submit-with-uploads', () => ({
  submitWithUploads: (_files: File[], action: (mediaIds: number[]) => unknown) => action([11]),
}))
vi.mock('@/lib/media/ingest-picked-files', () => ({
  ingestPickedFiles: async (files: File[]) => ({ files, blocked: [] }),
}))
vi.mock('@/components/worker-expenses/expense-draft-pages-cell', () => ({
  ExpenseDraftPagesCell: () => null,
}))

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów' }] as WorkerStageInvestmentT[]
const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

const noInvestmentDraft: ExpenseDraftRowT = {
  id: 7,
  workerId: 2,
  workerName: 'Jan',
  investmentId: null,
  investmentName: null,
  cashRegisterId: 3,
  note: null,
  status: 'pending',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: null,
  decidedByName: null,
  transfers: [],
  media: [{ id: 1, url: '/m/1.jpg', filename: '1.jpg', mimeType: 'image/jpeg' }],
  scanMode: 'one-invoice',
  aiRead: undefined,
}

async function openInvestmentSelect() {
  await userEvent.click(screen.getByRole('combobox'))
}

beforeEach(() => {
  sendExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
  updateExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
})

describe('ExpenseDraftDialog „Bez inwestycji”', () => {
  it('offers it beside the investments to a flagged worker, picking neither', async () => {
    const investments = [
      ...INVESTMENTS,
      { investmentId: 2, name: 'Wola' },
    ] as WorkerStageInvestmentT[]
    render(<ExpenseDraftDialog investments={investments} registers={REGISTERS} canSkipInvestment />)
    await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Wybierz inwestycję')
    await openInvestmentSelect()
    expect(screen.getByRole('option', { name: 'Bez inwestycji' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Mokotów' })).toBeInTheDocument()
  })

  it('does not offer it to an unflagged worker', async () => {
    render(
      <ExpenseDraftDialog
        investments={
          [...INVESTMENTS, { investmentId: 2, name: 'Wola' }] as WorkerStageInvestmentT[]
        }
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

  // Unflagged after he sent it: the draft keeps the option it was sent with.
  it('keeps it selected when an unflagged worker edits a draft without an investment', async () => {
    render(
      <ExpenseDraftDialog
        investments={INVESTMENTS}
        registers={REGISTERS}
        canSkipInvestment={false}
        draft={noInvestmentDraft}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edytuj wydatek' }))

    expect(screen.getByRole('combobox')).toHaveTextContent('Bez inwestycji')
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() =>
      expect(updateExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 7, investmentId: null }),
      ),
    )
  })
})
