import { render, screen } from '@testing-library/react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'

import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLN } from '@/lib/utils/format-currency'
import { bare } from '@/__tests__/helpers/money'

vi.mock('next/navigation', () => ({
  usePathname: () => '/zgloszenia-wydatkow',
  useRouter: () => ({ refresh: vi.fn() }),
}))

const accepted: ExpenseDraftRowT = {
  id: 7,
  workerId: 2,
  workerName: 'Jan',
  investmentId: 3,
  investmentName: 'Mieszkanie Mokotów',
  cashRegisterId: 1,
  note: null,
  status: 'accepted',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: '2026-10-06T12:00:00Z',
  decidedByName: 'Szef',
  // The manager moved it to another investment while accepting — the link follows the transaction.
  transfers: [{ id: 41, amount: 123.45, investmentId: 9, cancelled: false }],
  media: [],
  scanMode: 'one-invoice',
  aiRead: undefined,
}

const pending: ExpenseDraftRowT = {
  ...accepted,
  id: 8,
  status: 'pending',
  decidedAt: null,
  decidedByName: null,
  transfers: [],
}

function Table({ rows, isManagerView }: { rows: ExpenseDraftRowT[]; isManagerView: boolean }) {
  const columns = useExpenseDraftColumns({ isManagerView })
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} data-testid={`row-${row.original.id}`}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} data-column={cell.column.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const cell = (draftId: number, column: string) =>
  screen.getByTestId(`row-${draftId}`).querySelector(`[data-column="${column}"]`)

describe('useExpenseDraftColumns', () => {
  it('links the manager to the booked transaction in the investment it was booked on', () => {
    render(<Table rows={[accepted]} isManagerView />)

    expect(screen.getByRole('link', { name: formatPLN(123.45) })).toHaveAttribute(
      'href',
      '/inwestycje/9?id=41',
    )
  })

  it('shows the worker the amount as plain text — he cannot open a transaction', () => {
    render(<Table rows={[accepted]} isManagerView={false} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(bare(cell(7, 'transfers')?.textContent ?? '')).toBe(bare(formatPLN(123.45)))
    expect(cell(7, 'workerName')).toBeNull()
  })

  it('names who decided and when, and a dash while nothing is decided or booked', () => {
    render(<Table rows={[accepted, pending]} isManagerView />)

    expect(cell(7, 'decidedAt')).toHaveTextContent(/· Szef$/)
    expect(cell(8, 'decidedAt')).toHaveTextContent('—')
    expect(cell(8, 'transfers')).toHaveTextContent('—')
  })

  it('strikes out a cancelled transaction and links to it with the cancelled ones shown', () => {
    render(
      <Table
        rows={[{ ...accepted, transfers: [{ ...accepted.transfers[0], cancelled: true }] }]}
        isManagerView
      />,
    )

    const link = screen.getByRole('link', { name: formatPLN(123.45) })
    expect(link).toHaveAttribute('href', '/inwestycje/9?id=41&showCancelled=1')
    expect(link.firstElementChild).toHaveClass('line-through')
  })

  it('shows a dash for an accepted draft whose transaction was deleted', () => {
    render(<Table rows={[{ ...accepted, transfers: [] }]} isManagerView />)

    expect(cell(7, 'transfers')).toHaveTextContent('—')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
