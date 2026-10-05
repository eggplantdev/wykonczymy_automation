import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CellContext } from '@tanstack/react-table'
import { getTransferColumns } from '@/components/tables/transfers'
import { transferRow } from '@/__tests__/fixtures/transfer-row'
import type { RoleT } from '@/lib/auth/roles'
import type { TransferRowT } from '@/types/transfers'

// `/inwestycje/[id]` and `/kasa/[id]` are management-only: a link there sends a worker into a 404.
function renderCell(columnId: string, role: RoleT, value: string) {
  const column = getTransferColumns([], { currentUserRole: role }).find((c) => c.id === columnId)
  const cell = column?.cell
  if (typeof cell !== 'function') throw new Error(`Column "${columnId}" has no cell renderer`)
  const row = transferRow({ investmentId: 10, investmentName: value, sourceRegisterName: value })
  const info = { getValue: () => value, row: { original: row } } as unknown as CellContext<
    TransferRowT,
    unknown
  >
  render(<>{cell(info)}</>)
}

describe('transfer columns linking into management pages', () => {
  it('shows the investment as plain text to a worker', () => {
    renderCell('investment', 'EMPLOYEE', 'Inwestycja A')
    expect(screen.getByText('Inwestycja A').closest('a')).toBeNull()
  })

  it('keeps the investment link for management', () => {
    renderCell('investment', 'MANAGER', 'Inwestycja A')
    expect(screen.getByText('Inwestycja A').closest('a')).toHaveAttribute('href', '/inwestycje/10')
  })
})
