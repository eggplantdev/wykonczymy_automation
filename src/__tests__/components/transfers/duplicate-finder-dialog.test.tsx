import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DuplicateFinderDialog } from '@/components/transfers/duplicate-finder-dialog'
import type { CandidateT, DuplicateGroupsT } from '@/lib/expense-duplicates/types'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { ActionResultT } from '@/types/action'

const url = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => url.params,
  useRouter: () => ({ push: vi.fn() }),
}))

type FindGroupsT = (range: DateRangeT) => Promise<ActionResultT<DuplicateGroupsT<CandidateT>>>

const candidate = (
  fields: Partial<CandidateT> & Pick<CandidateT, 'source' | 'id'>,
): CandidateT => ({
  key: `${fields.source}-${fields.id}`,
  draftId: null,
  readRows: [],
  amount: 101.11,
  date: '2026-10-06T12:00:00Z',
  documentDate: null,
  documentNumber: null,
  sellerNip: null,
  description: null,
  invoiceNote: null,
  investmentId: null,
  investmentName: null,
  submitterName: null,
  registerName: null,
  pages: [],
  ...fields,
})

const GROUPS: DuplicateGroupsT<CandidateT> = {
  strong: [
    {
      key: 'strong-1',
      reasons: ['same-number'],
      members: [
        candidate({ source: 'transaction', id: 41, investmentId: 3, documentNumber: 'FV/1' }),
        candidate({ source: 'draft', id: 9, documentNumber: 'FV/1' }),
      ],
    },
  ],
  weak: [
    {
      key: 'weak-1',
      reasons: ['same-amount'],
      members: [
        candidate({ source: 'transaction', id: 51, amount: 7777.77 }),
        candidate({ source: 'transaction', id: 52, amount: 7777.77 }),
      ],
    },
  ],
}

async function analyse(findGroups: FindGroupsT) {
  render(<DuplicateFinderDialog findGroups={findGroups} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Szukaj duplikatów' }))
  await user.click(screen.getByRole('button', { name: 'Analizuj' }))
  return { user, dialog: screen.getByRole('dialog') }
}

beforeEach(() => {
  url.params = new URLSearchParams()
})

describe('DuplicateFinderDialog', () => {
  it('asks for the table’s range, shows strong groups open and weak ones folded under „Słabe”', async () => {
    url.params = new URLSearchParams({ from: '2026-10-01', to: '2026-10-31' })
    const findGroups = vi.fn<FindGroupsT>(async () => ({ success: true, data: GROUPS }))
    const { user, dialog } = await analyse(findGroups)

    expect(findGroups).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' })
    expect(await within(dialog).findByText('Ten sam numer · 2 dokumenty')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Transakcja #51' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Słabe \(1\)/ }))
    expect(within(dialog).getByRole('link', { name: 'Transakcja #51' })).toBeInTheDocument()
  })

  it('links a transakcja to its investment’s list and a zgłoszenie to the queue, each in a new tab', async () => {
    const { dialog } = await analyse(
      vi.fn<FindGroupsT>(async () => ({ success: true, data: GROUPS })),
    )

    const transaction = await within(dialog).findByRole('link', { name: 'Transakcja #41' })
    expect(transaction).toHaveAttribute('href', '/inwestycje/3?id=41')
    expect(transaction).toHaveAttribute('target', '_blank')
    const draft = within(dialog).getByRole('link', { name: 'Zgłoszenie #9' })
    expect(draft).toHaveAttribute('href', '/zgloszenia-wydatkow?zgloszenie=9')
    expect(draft).toHaveAttribute('target', '_blank')
  })

  it('says so when nothing was found', async () => {
    const empty: DuplicateGroupsT<CandidateT> = { strong: [], weak: [] }
    const { dialog } = await analyse(
      vi.fn<FindGroupsT>(async () => ({ success: true, data: empty })),
    )

    expect(
      await within(dialog).findByText('Nie znaleziono możliwych duplikatów'),
    ).toBeInTheDocument()
  })

  it('offers a retry after a failure', async () => {
    const findGroups = vi
      .fn<FindGroupsT>()
      .mockResolvedValueOnce({ success: false, error: 'Brak uprawnień' })
      .mockResolvedValueOnce({ success: true, data: GROUPS })
    const { user, dialog } = await analyse(findGroups)

    expect(await within(dialog).findByText('Brak uprawnień')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Spróbuj ponownie' }))

    expect(await within(dialog).findByText('Ten sam numer · 2 dokumenty')).toBeInTheDocument()
    expect(findGroups).toHaveBeenCalledTimes(2)
  })
})
