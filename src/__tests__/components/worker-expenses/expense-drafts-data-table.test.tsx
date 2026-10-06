import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseDraftsDataTable } from '@/components/worker-expenses/expense-drafts-data-table'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'

vi.mock('next/navigation', () => ({
  usePathname: () => '/zgloszenia-wydatkow',
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
const { restoreExpenseDraftAction, restoreSkippedReceiptAction } = vi.hoisted(() => ({
  restoreExpenseDraftAction: vi.fn(async () => ({ success: true })),
  restoreSkippedReceiptAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/actions/worker-expense-drafts', () => ({
  restoreExpenseDraftAction,
  restoreSkippedReceiptAction,
  readExpenseDraftAction: vi.fn(),
  rejectExpenseDraftAction: vi.fn(),
}))
vi.mock('@/lib/actions/transfers', () => ({ createBulkTransferAction: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const draft = (id: number, overrides: Partial<ExpenseDraftRowT> = {}): ExpenseDraftRowT => ({
  id,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 3,
  investmentName: `Inwestycja ${id}`,
  cashRegisterId: 1,
  note: null,
  status: 'rejected',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: '2026-10-06T12:00:00Z',
  decidedByName: 'Szef',
  transfers: [],
  media: [],
  scanMode: 'one-per-photo',
  aiRead: undefined,
  ...overrides,
})

function renderTable(rows: ExpenseDraftRowT[]) {
  return render(
    <ExpenseDraftsDataTable
      data={rows}
      paginationMeta={{ currentPage: 1, totalPages: 1, totalDocs: rows.length, limit: 50 }}
      investments={[]}
      workers={[]}
      referenceData={referenceDataFor('OWNER')}
    />,
  )
}

beforeEach(() => vi.clearAllMocks())

describe('„Przywróć” na liście „Zgłoszenia wydatków”', () => {
  it('a skipped paragon restores itself, not its accepted zgłoszenie', async () => {
    const user = userEvent.setup()
    renderTable([draft(7, { skippedReceipt: { id: 41, isRestorable: true } })])

    await user.click(screen.getByRole('button', { name: 'Przywróć' }))

    expect(restoreSkippedReceiptAction).toHaveBeenCalledWith(41)
    expect(restoreExpenseDraftAction).not.toHaveBeenCalled()
  })

  // The restore would be refused, so the row offers nothing.
  it('a skipped paragon whose party is in the trash offers no „Przywróć”', () => {
    renderTable([draft(7, { skippedReceipt: { id: 41, isRestorable: false } })])
    expect(screen.queryByRole('button', { name: 'Przywróć' })).toBeNull()
  })

  it('a rejected zgłoszenie still restores the whole zgłoszenie', async () => {
    const user = userEvent.setup()
    renderTable([draft(8)])

    await user.click(screen.getByRole('button', { name: 'Przywróć' }))

    expect(restoreExpenseDraftAction).toHaveBeenCalledWith(8)
    expect(restoreSkippedReceiptAction).not.toHaveBeenCalled()
  })
})
