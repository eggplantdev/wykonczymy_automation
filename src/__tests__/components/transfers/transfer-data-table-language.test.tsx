import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TransferDataTable } from '@/components/transfers/transfer-data-table'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'
import { CurrentUserProvider } from '@/hooks/use-current-user'
import { I18nContext } from '@/hooks/use-translation'
import type { LanguageT } from '@/lib/i18n/languages'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'

// EX-996: a worker set to Українська reads his transfers table in it, while every other screen —
// no provider — keeps the Polish it always had.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/pracownicy/7',
  useSearchParams: () => new URLSearchParams(),
}))

const CONFIG: TransferTableConfigT = {
  query: { page: 1, limit: 100, where: {}, sort: '-date' },
  baseUrl: '/pracownicy/7',
  filters: { transferTypes: TRANSFER_TYPES },
}

const renderTable = (locale?: LanguageT) => {
  const table = (
    <CurrentUserProvider user={{ id: 7, email: 'jan@test.invalid', name: 'Jan', role: 'EMPLOYEE' }}>
      <TransferDataTable
        data={[]}
        paginationMeta={{ currentPage: 1, totalPages: 1, totalDocs: 3, limit: 100 }}
        config={CONFIG}
      />
    </CurrentUserProvider>
  )
  return render(
    locale ? (
      <I18nContext.Provider value={{ locale, setLocale: () => {} }}>{table}</I18nContext.Provider>
    ) : (
      table
    ),
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('TransferDataTable language', () => {
  it('renders headers, filters and the pagination summary in Ukrainian', () => {
    renderTable('uk')

    expect(screen.getByRole('columnheader', { name: /Дата/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Сума/ })).toBeInTheDocument()
    expect(screen.getByText('Фільтри')).toBeInTheDocument()
    expect(screen.getByText('3 результати')).toBeInTheDocument()
    expect(screen.queryByText('Filtry')).not.toBeInTheDocument()
  })

  it('stays Polish without a provider', () => {
    renderTable()

    expect(screen.getByRole('columnheader', { name: /Data/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Kwota/ })).toBeInTheDocument()
    expect(screen.getByText('Filtry')).toBeInTheDocument()
    expect(screen.getByText('3 wyników')).toBeInTheDocument()
  })
})
