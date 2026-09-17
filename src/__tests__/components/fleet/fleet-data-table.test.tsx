import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FleetDataTable } from '@/components/fleet/fleet-data-table'
import { byInspectionType } from '@/lib/fleet/inspection-types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { FleetRowT } from '@/types/fleet'
import { bare } from '@/__tests__/helpers/money'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/flota',
  useSearchParams: () => new URLSearchParams(),
}))

const EMPTY_DEADLINES = byInspectionType(() => ({
  nextDueAt: null,
  daysLeft: null,
  bucket: null,
  hasEvent: false,
  exempt: false,
}))

const fleetRow = (id: number, registration: string, totalCosts: number | null): FleetRowT => ({
  id,
  registration,
  make: 'Ford',
  model: 'Transit',
  year: 2019,
  vin: `VIN${id}`,
  status: 'ACTIVE',
  tyres: 'zimowe',
  note: '',
  exemptions: [],
  flags: {},
  deadlines: EMPTY_DEADLINES,
  activeFlags: [],
  latestOdometer: null,
  kmSinceOilChange: null,
  totalCosts,
})

const FLEET = [
  fleetRow(1, 'WX 1000A', 1200),
  fleetRow(2, 'WX 2000B', 800),
  // „Nobody typed a price" — it must not be read as 0 zł, and it must not sink the whole sum.
  fleetRow(3, 'KR 3000C', null),
]

const totalRow = () => screen.getByText('Razem').closest('tr')

const expectTotal = (amount: number) =>
  expect(bare(totalRow()?.textContent ?? ''), 'stopka „Razem"').toContain(bare(formatPLN(amount)))

beforeEach(() => {
  // Column visibility persists under `storageKey="fleet"`, so a test that hides a column would
  // otherwise hand the next one a table missing it.
  localStorage.clear()
})

// EX-716 — „Razem" is computed in the browser from the rows left on screen. `sumKnown` is unit-covered;
// what no layer below the browser sees is that the footer follows the search box (a total nobody can
// add up from the visible rows is worse than none) and steps aside when its column is gone.
describe('Flota — stopka „Razem" mówi o tym, co widać', () => {
  it('sumuje tylko pojazdy, które zostały po wyszukaniu', async () => {
    render(<FleetDataTable data={FLEET} />)
    const user = userEvent.setup()

    expectTotal(2000)

    await user.type(screen.getByPlaceholderText('Szukaj...'), 'WX 1000')

    expect(screen.queryByText('WX 2000B'), 'odfiltrowany pojazd').not.toBeInTheDocument()
    expectTotal(1200)
  })

  it('znika razem z kolumną „Koszty"', async () => {
    render(<FleetDataTable data={FLEET} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Kolumny/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Koszty' }))

    expect(screen.queryByText('Razem'), 'stopka bez kolumny kosztów').not.toBeInTheDocument()
  })
})
