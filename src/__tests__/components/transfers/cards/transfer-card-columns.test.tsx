import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import type { TransferRowT } from '@/types/transfers'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/kasa/1',
  useSearchParams: () => new URLSearchParams(),
}))

const CONFIG: TransferTableConfigT = {
  query: { page: 1, limit: 100, where: {}, sort: '-date' },
  baseUrl: '/kasa/1',
  filters: { transferTypes: TRANSFER_TYPES },
}

const ROW: TransferRowT = {
  id: 1,
  description: 'Farba',
  amount: 100,
  netAmount: null,
  type: 'REGISTER_TRANSFER',
  paymentMethod: null,
  date: '2026-10-01',
  sourceRegisterId: 1,
  sourceRegisterName: 'Kasa A',
  targetRegisterId: 2,
  targetRegisterName: 'Kasa B',
  sourceRegisterTrashed: false,
  targetRegisterTrashed: false,
  investmentId: null,
  investmentName: '—',
  expenseCategoryId: null,
  expenseCategoryName: '—',
  otherCategoryName: '—',
  otherCategoryId: null,
  workerName: '—',
  workerId: null,
  createdByName: 'Jan',
  createdById: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  invoices: [],
  invoiceNote: null,
  documentNumber: null,
  sellerNip: null,
  documentDate: null,
  cancelled: false,
  settled: false,
  vatPlane: null,
  originalType: null,
  payoutStatus: null,
  payoutDecidedAt: null,
  payoutRejectionReason: null,
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('transfers:view', 'list')
})

describe('TransferCard column visibility', () => {
  it('drops a label whose column the viewer hid once the stored choice lands after hydration', async () => {
    localStorage.setItem('table-columns:transfers', JSON.stringify({ sourceRegister: false }))

    render(
      <CurrentUserProvider user={{ id: 1, email: 'jan@test.invalid', name: 'Jan', role: 'OWNER' }}>
        <TransferDataTable
          data={[ROW]}
          paginationMeta={{ currentPage: 1, totalPages: 1, totalDocs: 1, limit: 100 }}
          config={CONFIG}
        />
      </CurrentUserProvider>,
    )

    await waitFor(() => expect(screen.getByText('Kasa docelowa:')).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('Kasa źródłowa:')).not.toBeInTheDocument())
  })
})

// A phone gets the cards, not the table, so the status column has to reach them too.
describe('TransferCard payout status', () => {
  it('shows a wypłata’s status, and none on other types', async () => {
    render(
      <CurrentUserProvider user={{ id: 1, email: 'jan@test.invalid', name: 'Jan', role: 'OWNER' }}>
        <TransferDataTable
          data={[
            { ...ROW, id: 2, type: 'PAYOUT', payoutStatus: 'rejected' },
            { ...ROW, id: 3, payoutStatus: null },
          ]}
          paginationMeta={{ currentPage: 1, totalPages: 1, totalDocs: 2, limit: 100 }}
          config={CONFIG}
        />
      </CurrentUserProvider>,
    )

    const cardOf = async (id: number) =>
      within((await screen.findByText(`#${id}`)).closest('article')!)
    expect((await cardOf(2)).getByText('Odrzucona')).toBeInTheDocument()
    expect(
      (await cardOf(3)).queryByText(/Czeka na potwierdzenie|Potwierdzona|Odrzucona/),
    ).toBeNull()
  })
})
