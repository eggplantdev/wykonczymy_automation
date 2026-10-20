import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { UserDataTable } from '@/components/users/user-data-table'
import { ROLES } from '@/lib/auth/roles'
import { formatPLN } from '@/lib/utils/format-currency'
import type { PayoutBucketT } from '@/lib/kosztorys/worker-payout-pairs'
import type { UserRowT } from '@/types/table-rows'
import { bare } from '@/__tests__/helpers/money'
import { navigationState } from '@/__tests__/stubs/next-navigation'

navigationState.pathname = '/pracownicy'

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
  registerNames: [],
  canManage: true,
})

const bucket = (overrides: Partial<PayoutBucketT> = {}): PayoutBucketT => ({
  owed: 0,
  owedCount: 0,
  overpaid: 0,
  overpaidCount: 0,
  withheldCount: 0,
  ...overrides,
})

const rowOf = (name: string) => screen.getByText(name).closest('tr')!

// „Domyślna kasa" prints „—" too, so the dash is looked up in its own column.
const remainingCellOf = (name: string) => {
  const headers = screen.getAllByRole('columnheader')
  const index = headers.findIndex((header) => /Pozostało do wypłaty/.test(header.textContent ?? ''))
  return rowOf(name).querySelectorAll('td')[index] as HTMLElement
}

const cellText = (name: string) => bare(remainingCellOf(name).textContent ?? '')

beforeEach(() => {
  localStorage.clear()
})

describe('„Pozostało do wypłaty" on the employee list', () => {
  it('replaces the all-time „Wypłaty"', () => {
    render(
      <UserDataTable data={[worker(1, 'Jan')]} assignableRoles={[...ROLES]} />,
    )
    expect(screen.getByRole('columnheader', { name: /Pozostało do wypłaty/ })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^Wypłaty$/ })).not.toBeInTheDocument()
  })

  it('prints each figure on its own line, with its count and kwota, and „—" for a worker with no pair', () => {
    render(
      <UserDataTable
        data={[
          worker(1, 'Jan', {
            active: bucket({ owed: 5000, owedCount: 2, overpaid: 4000, overpaidCount: 1 }),
            completed: bucket(),
          }),
          worker(2, 'Piotr'),
        ]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    const row = within(rowOf('Jan'))
    expect(bare(row.getByText(/do zapłaty aktywne \(2\)/).textContent ?? '')).toContain(
      bare(formatPLN(5000)),
    )
    expect(bare(row.getByText(/nadpłata aktywne \(1\)/).textContent ?? '')).toContain(
      bare(formatPLN(4000)),
    )
    expect(cellText('Jan')).not.toContain(bare(formatPLN(1000)))
    expect(remainingCellOf('Piotr')).toHaveTextContent(/^—$/)
  })

  it('counts withheld pairs beside the figures', () => {
    render(
      <UserDataTable
        data={[
          worker(1, 'Jan', {
            active: bucket({ owed: 3000, owedCount: 1, withheldCount: 1 }),
            completed: bucket(),
          }),
        ]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    const row = within(rowOf('Jan'))
    expect(row.getByText('1 bez rozliczenia etapu')).toBeInTheDocument()
    expect(row.getByLabelText('Rozliczenie etapu niepotwierdzone')).toBeInTheDocument()
  })

  it('drops both zakończone lines by default and brings them back', async () => {
    const user = userEvent.setup()
    const jan = worker(1, 'Jan', {
      active: bucket({ overpaid: 1295.81, overpaidCount: 1 }),
      completed: bucket({ owed: 2000, owedCount: 1, overpaid: 80, overpaidCount: 2 }),
    })
    const { unmount } = render(
      <UserDataTable data={[jan]} assignableRoles={[...ROLES]} />,
    )
    const row = () => within(rowOf('Jan'))
    expect(row().getByText(/nadpłata aktywne \(1\)/)).toBeInTheDocument()
    expect(row().queryByText(/zakończone/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: /^Zakończone inwestycje/ }))
    expect(bare(row().getByText(/do zapłaty zakończone \(1\)/).textContent ?? '')).toContain(
      bare(formatPLN(2000)),
    )
    expect(bare(row().getByText(/nadpłata zakończone \(2\)/).textContent ?? '')).toContain(
      bare(formatPLN(80)),
    )

    unmount()
    render(<UserDataTable data={[jan]} assignableRoles={[...ROLES]} />)
    expect(row().getByText(/do zapłaty zakończone \(1\)/)).toBeInTheDocument()
  })

  it('empties the aktywne lines once only „Zakończone inwestycje" is ticked', async () => {
    const user = userEvent.setup()
    render(
      <UserDataTable
        data={[
          worker(1, 'Jan', { active: bucket({ owed: 5000, owedCount: 1 }), completed: bucket() }),
        ]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: /^Zakończone inwestycje/ }))
    await user.click(screen.getByRole('option', { name: /^Aktywne inwestycje/ }))
    expect(cellText('Jan')).toBe(bare(formatPLN(0)))
  })

  it('shows both kwoty once both „Pozostało do wypłaty" ticks are off — nothing ticked narrows nothing', async () => {
    const user = userEvent.setup()
    const jan = worker(1, 'Jan', {
      active: bucket({ owed: 5000, owedCount: 1 }),
      completed: bucket({ owed: 2000, owedCount: 1 }),
    })
    render(<UserDataTable data={[jan]} assignableRoles={[...ROLES]} />)
    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: /^Aktywne inwestycje/ }))

    const row = within(rowOf('Jan'))
    expect(row.getByText(/do zapłaty aktywne \(1\)/)).toBeInTheDocument()
    expect(row.getByText(/do zapłaty zakończone \(1\)/)).toBeInTheDocument()
  })

  it('lists inactive workers only once „Nieaktywni" is ticked', async () => {
    const user = userEvent.setup()
    render(
      <UserDataTable
        data={[worker(1, 'Jan'), { ...worker(2, 'Piotr'), active: false }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    expect(screen.queryByText('Piotr')).not.toBeInTheDocument()
    expect(screen.getByText('Widoczni pracownicy 1 / 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: 'Nieaktywni' }))
    expect(screen.getByText('Piotr')).toBeInTheDocument()
    expect(screen.getByText('Widoczni pracownicy 2 / 2')).toBeInTheDocument()
  })

  it('lists every worker once both „Pracownicy" ticks are off — nothing ticked narrows nothing', async () => {
    const user = userEvent.setup()
    render(
      <UserDataTable
        data={[worker(1, 'Jan'), { ...worker(2, 'Piotr'), active: false }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: 'Aktywni' }))

    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Piotr')).toBeInTheDocument()
  })

  it('„Wyczyść" unticks both groups — every worker and both kwoty show', async () => {
    const user = userEvent.setup()
    const jan = worker(1, 'Jan', {
      active: bucket({ owed: 5000, owedCount: 1 }),
      completed: bucket({ owed: 2000, owedCount: 1 }),
    })
    render(
      <UserDataTable
        data={[jan, { ...worker(2, 'Piotr'), active: false }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Filtry/ }))
    await user.click(screen.getByRole('option', { name: 'Wyczyść' }))

    expect(screen.getByText('Piotr')).toBeInTheDocument()
    expect(within(rowOf('Jan')).getByText(/do zapłaty zakończone \(1\)/)).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Wyczyść' })).not.toBeInTheDocument()
  })

  it('prints a green 0 when nothing is left to show', () => {
    render(
      <UserDataTable
        data={[
          worker(1, 'Jan', {
            active: bucket(),
            completed: bucket({ owed: 2000, owedCount: 1 }),
          }),
        ]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    expect(cellText('Jan')).toBe(bare(formatPLN(0)))
  })
})

describe('„Status" on the employee list', () => {
  it('toggles only on a row the viewer may manage', () => {
    render(
      <UserDataTable
        data={[worker(1, 'Jan'), { ...worker(2, 'Piotr'), canManage: false }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    expect(within(rowOf('Jan')).getByRole('button', { name: 'Aktywny' })).toBeVisible()
    expect(
      within(rowOf('Piotr')).queryByRole('button', { name: 'Aktywny' }),
    ).not.toBeInTheDocument()
    expect(within(rowOf('Piotr')).getByText('Aktywny')).toBeVisible()
  })
})

describe('„Do kosza" on the employee list', () => {
  it('offers the button only on a row the viewer may trash', () => {
    render(
      <UserDataTable
        data={[worker(1, 'Jan'), { ...worker(2, 'Piotr'), canManage: false }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    expect(within(rowOf('Jan')).getByRole('button', { name: 'Usuń pracownika' })).toBeVisible()
    expect(
      within(rowOf('Piotr')).queryByRole('button', { name: 'Usuń pracownika' }),
    ).not.toBeInTheDocument()
  })

  it('names the kasy that go to the trash with the worker', async () => {
    const user = userEvent.setup()
    render(
      <UserDataTable
        data={[{ ...worker(1, 'Jan'), registerNames: ['Kasa Jana'] }]}
       
        assignableRoles={[...ROLES]}
      />,
    )
    await user.click(within(rowOf('Jan')).getByRole('button', { name: 'Usuń pracownika' }))
    expect(screen.getByText(/Razem z nim kasa: Kasa Jana\./)).toBeVisible()
  })
})
