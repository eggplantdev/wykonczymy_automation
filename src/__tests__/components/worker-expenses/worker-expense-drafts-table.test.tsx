import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WorkerExpenseDraftsTable } from '@/components/worker-expenses/worker-expense-drafts-table'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/pracownicy/2',
  useRouter: () => ({ refresh: vi.fn(), replace, push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/worker-expenses/expense-draft-dialog', () => ({
  ExpenseDraftDialog: ({ draft }: { draft: ExpenseDraftRowT }) => <span>Edytuj {draft.id}</span>,
}))
vi.mock('@/components/worker-expenses/delete-expense-draft-button', () => ({
  DeleteExpenseDraftButton: ({ draftId }: { draftId: number }) => <span>Usuń {draftId}</span>,
}))

const draft = (id: number, overrides: Partial<ExpenseDraftRowT> = {}): ExpenseDraftRowT => ({
  id,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 3,
  investmentName: `Inwestycja ${id}`,
  cashRegisterId: 1,
  note: null,
  status: 'accepted',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: '2026-10-06T12:00:00Z',
  decidedByName: 'Szef',
  transferId: 100 + id,
  transferAmount: 50,
  transferInvestmentId: 3,
  media: [],
  scanMode: 'one-invoice',
  aiRead: undefined,
  ...overrides,
})

const drafts = Array.from({ length: 25 }, (_, i) => draft(i + 1))
const shownIds = () =>
  screen.queryAllByText(/^Inwestycja \d+$/).map((el) => Number(el.textContent?.split(' ')[1]))

function renderTable(rows: ExpenseDraftRowT[], canSend = true) {
  return render(
    <WorkerExpenseDraftsTable drafts={rows} canSend={canSend} investments={[]} registers={[]} />,
  )
}

describe('WorkerExpenseDraftsTable', () => {
  it('pages 25 drafts as 10, 10 and 5 without touching the URL', async () => {
    const user = userEvent.setup()
    renderTable(drafts)
    expect(shownIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    await user.click(screen.getByRole('button', { name: /2$/ }))
    expect(shownIds()).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])

    await user.click(screen.getByRole('button', { name: /3$/ }))
    expect(shownIds()).toEqual([21, 22, 23, 24, 25])
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('shows no page switch while everything fits on one page', () => {
    renderTable(drafts.slice(0, 10))

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('offers Edytuj and Usuń only on the pending drafts of the own page', () => {
    renderTable([draft(1, { status: 'pending', decidedAt: null, transferId: null }), draft(2)])

    const pendingRow = screen.getByText('Inwestycja 1').closest('tr')!
    const acceptedRow = screen.getByText('Inwestycja 2').closest('tr')!
    expect(within(pendingRow).getByText('Edytuj 1')).toBeInTheDocument()
    expect(within(pendingRow).getByText('Usuń 1')).toBeInTheDocument()
    expect(within(acceptedRow).queryByText(/Edytuj|Usuń/)).not.toBeInTheDocument()
  })

  it('gives a manager on the worker page no actions', () => {
    renderTable([draft(1, { status: 'pending', decidedAt: null, transferId: null })], false)

    expect(screen.queryByText(/Edytuj|Usuń/)).not.toBeInTheDocument()
  })

  it('shows the amount without a link to the transaction', () => {
    renderTable([draft(1)])

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
