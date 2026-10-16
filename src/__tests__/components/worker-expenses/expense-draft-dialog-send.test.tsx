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

describe('ExpenseDraftDialog send', () => {
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

  it('asks nothing about how several photos are read', async () => {
    await openNewAndPick(3)

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.queryByText('Jeden wydatek')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Wyślij' }))

    await waitFor(() => expect(sendExpenseDraftAction).toHaveBeenCalledTimes(1))
    expect(sendExpenseDraftAction.mock.calls[0][0]).not.toHaveProperty('scanMode')
    expect(sendExpenseDraftAction.mock.calls[0][0]).toMatchObject({ mediaIds: [11, 12] })
  })

  it('nine photos block „Wyślij” before anything goes up', async () => {
    await openNewAndPick(9)

    expect(screen.getByRole('alert')).toHaveTextContent('Najwyżej 8 zdjęć w jednym wydatku')
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled()
  })
})
