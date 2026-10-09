import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { formatPLN } from '@/lib/utils/format-currency'
import type { InvestmentRowT } from '@/types/table-rows'
import { bare } from '@/__tests__/helpers/money'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/inwestycje',
  useSearchParams: () => new URLSearchParams(),
}))

// OWNER, because Marża v2 is behind the admin/owner gate.
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ id: 1, email: 'o@example.test', name: 'Testowy', role: 'OWNER' }),
}))

// The Kijowska shape: settled netto on materials alone, no kosztorys, no work, no wypłaty.
const investment = (overrides: Partial<InvestmentRowT> = {}): InvestmentRowT => ({
  id: 1,
  name: 'Kijowska 17',
  status: 'active',
  totalMaterialCosts: 18661.21,
  totalIncome: 0,
  totalLaborCosts: 0,
  totalLaborCostsFromTransactions: 0,
  totalPayouts: 0,
  totalInvestmentExpense: 18661.21,
  totalSettled: 150,
  balance: -18661.21,
  balanceGross: -20154.11,
  balanceFromTransactions: -18661.21,
  margin: 0,
  marginV2: -150,
  subcontractorRemaining: undefined,
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  reviewRequested: false,
  notes: '',
  hasSheet: false,
  createdAt: '2026-01-15T10:00:00.000Z',
  hasKosztorys: false,
  hasAiDraft: false,
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: 8,
  ...overrides,
})

const columnIndex = (header: RegExp) =>
  screen.getAllByRole('columnheader').findIndex((th) => header.test(th.textContent ?? ''))

const cellOf = (name: string, header: RegExp) =>
  screen.getByText(name).closest('tr')!.querySelectorAll('td')[columnIndex(header)] as HTMLElement

const cellText = (name: string, header: RegExp) => bare(cellOf(name, header).textContent ?? '')

const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => tr.querySelector('td')?.textContent ?? '')

const BALANCE_NET = /Bilans netto v2/
const BALANCE_GROSS = /Bilans brutto v2/
const LABOR_V2 = /Robocizna v2/
const MARGIN_V2 = /Marża v2/
const REMAINING = /Pozostało do wypłaty/

beforeEach(() => {
  localStorage.clear()
})

describe('investments listing without a kosztorys', () => {
  it('prints the real v2 figures for an investment settled on materials alone', () => {
    render(<InvestmentDataTable data={[investment()]} presets={[]} />)

    expect(cellText('Kijowska 17', BALANCE_NET)).toBe(bare(formatPLN(-18661.21)))
    expect(cellText('Kijowska 17', LABOR_V2)).toBe(bare(formatPLN(0)))
    expect(cellText('Kijowska 17', MARGIN_V2)).toBe(bare(formatPLN(-150)))
    expect(cellOf('Kijowska 17', REMAINING)).toHaveTextContent('brak kosztorysu')
    expect(screen.queryByText('brak danych')).not.toBeInTheDocument()
  })

  it('flags robocizna booked only as transfers with the rozjazd icon', () => {
    render(
      <InvestmentDataTable
        data={[
          investment(),
          investment({ id: 2, name: 'Altowa 12', totalLaborCostsFromTransactions: 342334 }),
        ]}
        presets={[]}
      />,
    )

    expect(
      within(cellOf('Altowa 12', LABOR_V2)).getByLabelText('Niezgodność z transakcjami'),
    ).toBeInTheDocument()
    expect(
      within(cellOf('Kijowska 17', LABOR_V2)).queryByLabelText('Niezgodność z transakcjami'),
    ).not.toBeInTheDocument()
  })

  it('reads −wypłaty on a kosztorys with no executed work yet', () => {
    render(
      <InvestmentDataTable
        data={[
          investment({ hasKosztorys: true, totalPayouts: 5072, subcontractorRemaining: -5072 }),
        ]}
        presets={[]}
      />,
    )

    expect(cellText('Kijowska 17', REMAINING)).toBe(bare(formatPLN(-5072)))
  })

  it('sorts a no-kosztorys bilans by its value, not last', async () => {
    render(
      <InvestmentDataTable
        data={[
          investment({ id: 1, name: 'A', balance: 1000 }),
          investment({ id: 2, name: 'B', balance: -500, hasKosztorys: true }),
          investment({ id: 3, name: 'C', balance: 2000, hasKosztorys: true }),
          investment({ id: 4, name: 'D', settlementMode: 'GROSS' }),
        ]}
        presets={[]}
      />,
    )

    const header = screen.getAllByRole('columnheader')[columnIndex(BALANCE_NET)]
    await userEvent.click(header)
    const firstOrder = rowNames()
    await userEvent.click(header)

    expect([
      ['C', 'A', 'B', 'D'],
      ['B', 'A', 'C', 'D'],
    ]).toContainEqual(firstOrder)
    expect(rowNames()).toEqual([...firstOrder.slice(0, 3).reverse(), 'D'])
  })

  it('keeps a withheld „Pozostało do wypłaty" last', async () => {
    render(
      <InvestmentDataTable
        data={[
          investment({ id: 1, name: 'A' }),
          investment({ id: 2, name: 'B', hasKosztorys: true, subcontractorRemaining: 300 }),
          investment({ id: 3, name: 'C', hasKosztorys: true, subcontractorRemaining: -200 }),
        ]}
        presets={[]}
      />,
    )

    const header = screen.getAllByRole('columnheader')[columnIndex(REMAINING)]
    await userEvent.click(header)
    const firstOrder = rowNames()
    await userEvent.click(header)

    expect(firstOrder.at(-1)).toBe('A')
    expect(rowNames()).toEqual([firstOrder[1], firstOrder[0], 'A'])
  })
})

describe('the bilans column outside the tryb', () => {
  it('names the tryb instead of „nie dotyczy"', () => {
    render(
      <InvestmentDataTable
        data={[
          investment({ id: 1, name: 'Netto' }),
          investment({ id: 2, name: 'Brutto', settlementMode: 'GROSS' }),
          investment({ id: 3, name: 'Mieszane', settlementMode: 'MIXED' }),
        ]}
        presets={[]}
      />,
    )

    expect(cellOf('Netto', BALANCE_GROSS)).toHaveTextContent('rozliczenie netto')
    expect(cellOf('Brutto', BALANCE_NET)).toHaveTextContent('rozliczenie brutto')
    expect(cellOf('Mieszane', BALANCE_GROSS)).toHaveTextContent('rozliczenie mieszane')
    expect(screen.queryByText('nie dotyczy')).not.toBeInTheDocument()
  })
})
