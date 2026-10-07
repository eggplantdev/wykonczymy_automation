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
const { submitWithUploads } = vi.hoisted(() => ({
  submitWithUploads: vi.fn((_files: File[], action: (mediaIds: number[]) => unknown) =>
    action([11, 12]),
  ),
}))
vi.mock('@/lib/media/submit-with-uploads', () => ({ submitWithUploads }))
vi.mock('@/lib/media/ingest-picked-files', () => ({
  ingestPickedFiles: async (files: File[]) => ({ files, blocked: [] }),
}))
vi.mock('@/components/worker-expenses/expense-draft-pages-cell', () => ({
  ExpenseDraftPagesCell: () => null,
}))

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów' }] as WorkerStageInvestmentT[]
const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

async function openNewAndPick(count: number) {
  const { container } = render(
    <ExpenseDraftDialog investments={INVESTMENTS} registers={REGISTERS} />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Dodaj wydatek' }))
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error(`no file input in ${container.innerHTML}`)
  await userEvent.upload(
    input,
    Array.from({ length: count }, (_, index) => photo(`p${index}.jpg`)),
  )
}

const draftWith = (overrides: Partial<ExpenseDraftRowT>): ExpenseDraftRowT => ({
  id: 7,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 1,
  investmentName: 'Mokotów',
  cashRegisterId: 3,
  note: null,
  status: 'pending',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: null,
  decidedByName: null,
  transfers: [],
  media: [],
  scanMode: 'one-invoice',
  aiRead: undefined,
  ...overrides,
})

const page = (id: number) => ({
  id,
  url: `/m/${id}.jpg`,
  filename: `${id}.jpg`,
  mimeType: 'image/jpeg',
})

beforeEach(() => {
  submitWithUploads.mockClear()
  sendExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
  updateExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
})

describe('ExpenseDraftDialog scan mode', () => {
  it('offers no choice for one photo and sends „Jeden wydatek”', async () => {
    await openNewAndPick(1)

    expect(screen.queryByRole('radio', { name: 'Kilka wydatków' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-invoice', mediaIds: [11, 12] }),
      ),
    )
  })

  // Every upload goes through the size router now (EX-1014); what the dialog still owns is the kind.
  it('uploads the photos as faktury', async () => {
    await openNewAndPick(1)
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(submitWithUploads).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        'faktura',
      ),
    )
  })

  it('defaults two photos to „Jeden wydatek”', async () => {
    await openNewAndPick(2)

    expect(screen.getByRole('radio', { name: 'Jeden wydatek' })).toHaveAttribute('data-state', 'on')
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-invoice' }),
      ),
    )
  })

  it('sends „Kilka wydatków” once the worker switches to it', async () => {
    await openNewAndPick(2)

    await userEvent.click(screen.getByRole('radio', { name: 'Kilka wydatków' }))
    expect(screen.getByText(/Każde zdjęcie to osobny paragon/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-per-photo' }),
      ),
    )
  })

  it('„Edytuj” starts from the draft’s own mode', async () => {
    const draft = draftWith({ media: [page(1), page(2)], scanMode: 'one-per-photo' })
    render(<ExpenseDraftDialog investments={INVESTMENTS} registers={REGISTERS} draft={draft} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edytuj wydatek' }))

    expect(screen.getByRole('radio', { name: 'Kilka wydatków' })).toHaveAttribute(
      'data-state',
      'on',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() =>
      expect(updateExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: 7, scanMode: 'one-per-photo' }),
      ),
    )
  })

  it('nine photos block „Wyślij” before anything goes up', async () => {
    await openNewAndPick(9)

    expect(screen.getByRole('alert')).toHaveTextContent('Najwyżej 8 zdjęć w jednym wydatku')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })

  // A changed mode clears the read and reads again — a note edit must not count as one.
  it('„Edytuj” on a one-photo draft keeps its mode', async () => {
    const draft = draftWith({ media: [page(1)], scanMode: 'one-per-photo' })
    render(<ExpenseDraftDialog investments={INVESTMENTS} registers={REGISTERS} draft={draft} />)

    await userEvent.click(screen.getByRole('button', { name: 'Edytuj wydatek' }))
    await userEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    await waitFor(() =>
      expect(updateExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-per-photo' }),
      ),
    )
  })
})
