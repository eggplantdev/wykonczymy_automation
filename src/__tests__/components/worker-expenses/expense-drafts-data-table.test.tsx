import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExpenseDraftsDataTable } from '@/components/worker-expenses/expense-drafts-data-table'
import {
  restoreExpenseDraftAction,
  restoreSkippedReceiptAction,
} from '@/lib/actions/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { referenceDataFor } from '@/__tests__/helpers/reference-data'
import { navigationState } from '@/__tests__/stubs/next-navigation'

navigationState.pathname = '/zgloszenia-wydatkow'

vi.mocked(restoreExpenseDraftAction).mockResolvedValue({ success: true })
vi.mocked(restoreSkippedReceiptAction).mockResolvedValue({ success: true })

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
  acceptedReadRows: [],
  rejectedReceipts: [],
  media: [],
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

describe('„Przywróć” na liście „Zgłoszenia wydatków”', () => {
  it('a skipped paragon restores itself, not its accepted zgłoszenie', async () => {
    const user = userEvent.setup()
    renderTable([draft(7, { skippedReceipt: { id: 41, isRestorable: true } })])

    await user.click(screen.getByRole('button', { name: 'Przywróć' }))

    expect(restoreSkippedReceiptAction).toHaveBeenCalledWith(41)
    expect(restoreExpenseDraftAction).not.toHaveBeenCalled()
  })

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

describe('zgłoszenie bez inwestycji na liście „Zgłoszenia wydatków”', () => {
  it('shows „Bez inwestycji” in the investment column', () => {
    renderTable([draft(9, { investmentId: null, investmentName: null })])

    expect(screen.getByRole('cell', { name: 'Bez inwestycji' })).toBeInTheDocument()
  })
})
