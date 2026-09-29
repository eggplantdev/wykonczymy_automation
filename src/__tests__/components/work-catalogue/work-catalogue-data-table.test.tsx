import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkCatalogueDataTable } from '@/components/work-catalogue/work-catalogue-data-table'
import { countCatalogueUsage } from '@/lib/queries/catalogue-usage'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/katalog-prac',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/queries/catalogue-usage', () => ({ countCatalogueUsage: vi.fn() }))

const praca = (id: number, description: string): WorkCatalogueItemT => ({
  id,
  description,
  category: null,
  unit: 'szt',
  clientPrice: 100,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: `${description.toLowerCase()}|szt`,
})

const syfon = praca(1, 'Montaż syfonu')

beforeEach(() => {
  localStorage.clear()
  vi.mocked(countCatalogueUsage).mockResolvedValue({
    success: true,
    data: {
      byId: { [syfon.id]: 3 },
      otherUnitIds: [],
      uncatalogued: [
        { key: 'fugowanie|mb', description: 'Fugowanie', unit: 'mb', kosztorysCount: 2, hints: [] },
      ],
    },
  })
})

describe('WorkCatalogueDataTable — „Policz użycia"', () => {
  it('drops the count once the cennik changes, so a praca added since never reads as unused', async () => {
    const { rerender } = render(<WorkCatalogueDataTable data={[syfon]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Policz użycia' }))
    expect(
      await screen.findByRole('button', { name: /Używane, a brak w katalogu/ }),
    ).toBeInTheDocument()

    rerender(<WorkCatalogueDataTable data={[syfon, praca(2, 'Fugowanie')]} />)

    expect(screen.queryByRole('button', { name: /Używane, a brak w katalogu/ })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /Kosztorysy/ })).toBeNull()
  })
})
