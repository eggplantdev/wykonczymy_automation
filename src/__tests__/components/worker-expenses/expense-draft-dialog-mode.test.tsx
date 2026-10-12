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
const { submitWithUploads } = vi.hoisted(() => ({
  submitWithUploads: vi.fn((_files: File[], action: (mediaIds: number[]) => unknown) =>
    action([11, 12]),
  ),
}))
vi.mock('@/lib/media/submit-with-uploads', () => ({ submitWithUploads }))
vi.mock('@/lib/media/ingest-picked-files', () => ({
  ingestPickedFiles: async (files: File[]) => ({ files, blocked: [] }),
}))

const INVESTMENTS = [{ investmentId: 1, name: 'Mokotów' }] as WorkerStageInvestmentT[]
const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

async function openNewAndPick(count: number) {
  const { container } = render(
    <ExpenseDraftDialog
      investments={INVESTMENTS}
      registers={REGISTERS}
      canSkipInvestment={false}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Wydatek' }))
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error(`no file input in ${container.innerHTML}`)
  await userEvent.upload(
    input,
    Array.from({ length: count }, (_, index) => photo(`p${index}.jpg`)),
  )
}

beforeEach(() => {
  submitWithUploads.mockClear()
  sendExpenseDraftAction.mockReset().mockResolvedValue({ success: true })
})

describe('ExpenseDraftDialog scan mode', () => {
  it('offers no choice for one photo', async () => {
    await openNewAndPick(1)

    expect(screen.queryByRole('radio', { name: 'Kilka wydatków' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-per-photo', mediaIds: [11, 12] }),
      ),
    )
  })

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

  it('defaults two photos to „Kilka wydatków”', async () => {
    await openNewAndPick(2)

    expect(screen.getByRole('radio', { name: 'Kilka wydatków' })).toHaveAttribute(
      'data-state',
      'on',
    )
    expect(screen.getByText(/Każde zdjęcie to osobny paragon/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-per-photo' }),
      ),
    )
  })

  it('sends „Jeden wydatek” only once the worker confirms it', async () => {
    await openNewAndPick(2)

    await userEvent.click(screen.getByRole('radio', { name: 'Jeden wydatek' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tak, jedna faktura' }))
    expect(screen.getByRole('radio', { name: 'Jeden wydatek' })).toHaveAttribute('data-state', 'on')
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-invoice' }),
      ),
    )
  })

  // A single photo of paragony laid side by side would otherwise be summed into one amount.
  it('drops „Jeden wydatek” once the photos are re-picked down to one', async () => {
    await openNewAndPick(2)
    await userEvent.click(screen.getByRole('radio', { name: 'Jeden wydatek' }))
    await userEvent.click(screen.getByRole('button', { name: 'Tak, jedna faktura' }))

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('no file input')
    await userEvent.upload(input, [photo('one.jpg')])
    expect(screen.queryByRole('radio', { name: 'Jeden wydatek' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() =>
      expect(sendExpenseDraftAction).toHaveBeenCalledWith(
        expect.objectContaining({ scanMode: 'one-per-photo' }),
      ),
    )
  })

  it('keeps „Kilka wydatków” when the confirm is cancelled', async () => {
    await openNewAndPick(2)

    await userEvent.click(screen.getByRole('radio', { name: 'Jeden wydatek' }))
    await userEvent.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(screen.getByRole('radio', { name: 'Kilka wydatków' })).toHaveAttribute(
      'data-state',
      'on',
    )
  })

  it('nine photos block „Wyślij” before anything goes up', async () => {
    await openNewAndPick(9)

    expect(screen.getByRole('alert')).toHaveTextContent('Najwyżej 8 zdjęć w jednym wydatku')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })
})
