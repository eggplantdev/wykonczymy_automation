import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LeadsDataTable } from '@/components/leads/leads-data-table'
import { trashLeadsAction } from '@/lib/actions/lead-trash'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { LeadRowT } from '@/types/leads'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/zgloszenia',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/lead-trash', () => ({
  trashLeadsAction: vi.fn(async () => ({ success: true, data: { trashed: 2 } })),
}))

const leadRow = (id: number, name: string): LeadRowT => ({
  id,
  source: 'website_form',
  name,
  email: '',
  phone: '',
  address: '',
  scope: '',
  area: '',
  formName: '',
  submittedAt: null,
  contactStatus: 'new',
  answers: [],
  assets: [],
  investmentId: null,
  investmentName: null,
  investmentAssetIds: [],
})

const PAGE = [leadRow(1, 'Anna Kowalska'), leadRow(2, 'Jan Nowak'), leadRow(3, 'Ewa Wiśniewska')]

const PAGINATION: PaginationMetaT = {
  currentPage: 1,
  totalPages: 1,
  totalDocs: PAGE.length,
  limit: 50,
}

const renderTable = (data: LeadRowT[] = PAGE) =>
  render(<LeadsDataTable data={data} paginationMeta={PAGINATION} investments={[]} />)

beforeEach(() => {
  localStorage.clear()
  vi.mocked(trashLeadsAction).mockClear()
})

describe('/zgloszenia — zaznaczanie i „Do kosza"', () => {
  it('the header checkbox selects every row on the page', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz wszystkie na stronie' }))

    expect(screen.getByRole('button', { name: /Do kosza \(3\)/ })).toBeInTheDocument()
    for (const lead of PAGE) {
      expect(screen.getByRole('checkbox', { name: `Zaznacz ${lead.name}` })).toBeChecked()
    }
  })

  it('trashes exactly the ticked leads after the confirm', async () => {
    const user = userEvent.setup()
    renderTable()

    expect(screen.queryByRole('button', { name: /Do kosza/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz Anna Kowalska' }))
    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz Ewa Wiśniewska' }))
    await user.click(screen.getByRole('button', { name: /Do kosza \(2\)/ }))

    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('Przenieść 2 zgłoszenia do kosza?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Przenieś do kosza' }))

    expect(trashLeadsAction).toHaveBeenCalledWith([1, 3])
  })

  it('drops the ticks of rows that left the page', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTable()

    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz Jan Nowak' }))
    expect(screen.getByRole('button', { name: /Do kosza \(1\)/ })).toBeInTheDocument()

    const nextPage = [leadRow(4, 'Piotr Zieliński'), leadRow(5, 'Ola Lis')]
    rerender(<LeadsDataTable data={nextPage} paginationMeta={PAGINATION} investments={[]} />)

    expect(screen.queryByRole('button', { name: /Do kosza/ })).not.toBeInTheDocument()
  })

  it('keeps the ticks when a refresh brings the same rows back', async () => {
    const user = userEvent.setup()
    const { rerender } = renderTable()

    await user.click(screen.getByRole('checkbox', { name: 'Zaznacz Jan Nowak' }))
    rerender(<LeadsDataTable data={[...PAGE]} paginationMeta={PAGINATION} investments={[]} />)

    expect(screen.getByRole('checkbox', { name: 'Zaznacz Jan Nowak' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Do kosza \(1\)/ })).toBeInTheDocument()
  })
})
