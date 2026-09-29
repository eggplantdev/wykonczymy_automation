import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserDataTable } from '@/components/users/user-data-table'
import { formatPLN } from '@/lib/utils/format-currency'
import type { UserRowT } from '@/types/table-rows'
import { bare } from '@/__tests__/helpers/money'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/pracownicy',
  useSearchParams: () => new URLSearchParams(),
}))

const worker = (
  id: number,
  name: string,
  payoutRemaining?: UserRowT['payoutRemaining'],
): UserRowT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `w${id}@example.com`,
  active: true,
  payoutRemaining,
})

const rowOf = (name: string) => screen.getByText(name).closest('tr')!

// „Domyślna kasa" prints „—" too, so the dash is looked up in its own column.
const remainingCellOf = (name: string) => {
  const headers = screen.getAllByRole('columnheader')
  const index = headers.findIndex((header) => /Pozostało do wypłaty/.test(header.textContent ?? ''))
  return rowOf(name).querySelectorAll('td')[index] as HTMLElement
}

beforeEach(() => {
  localStorage.clear()
})

describe('„Pozostało do wypłaty" on the employee list', () => {
  it('replaces the all-time „Wypłaty"', () => {
    render(<UserDataTable data={[worker(1, 'Jan')]} cashRegisters={[]} />)
    expect(screen.getByRole('columnheader', { name: /Pozostało do wypłaty/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^Wypłaty$/ })).not.toBeInTheDocument()
  })

  it('prints the owed sum, and „—" for a worker with no pair', () => {
    render(
      <UserDataTable
        data={[
          worker(1, 'Jan', { owed: 3000, overpaidCount: 0, withheldCount: 0 }),
          worker(2, 'Piotr'),
        ]}
        cashRegisters={[]}
      />,
    )
    expect(bare(remainingCellOf('Jan').textContent ?? '')).toBe(bare(formatPLN(3000)))
    expect(remainingCellOf('Piotr')).toHaveTextContent(/^—$/)
  })

  it('counts nadpłaty and withheld pairs beside the sum instead of netting them', () => {
    render(
      <UserDataTable
        data={[worker(1, 'Jan', { owed: 3000, overpaidCount: 2, withheldCount: 1 })]}
        cashRegisters={[]}
      />,
    )
    const row = within(rowOf('Jan'))
    expect(bare(rowOf('Jan').textContent ?? '')).toContain(bare(formatPLN(3000)))
    expect(row.getByText('nadpłata na 2 inwestycjach')).toBeInTheDocument()
    expect(row.getByText('1 bez rozliczenia etapu')).toBeInTheDocument()
    expect(row.getByLabelText('Rozliczenie etapu niepotwierdzone')).toBeInTheDocument()
  })
})
