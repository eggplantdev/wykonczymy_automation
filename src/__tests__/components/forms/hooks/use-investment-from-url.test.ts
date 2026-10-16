import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePathname } from 'next/navigation'
import { useInvestmentFromUrl } from '@/components/forms/hooks/use-investment-from-url'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { InvestmentRefT } from '@/types/reference-data'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

const ref = (id: number, status: InvestmentStatusT) => ({ id, name: `Inwestycja ${id}`, status })

const INVESTMENTS = [
  ref(1, 'active'),
  ref(2, 'planowana'),
  ref(3, 'quote'),
  ref(4, 'rejected'),
  ref(5, 'completed'),
] as InvestmentRefT[]

const seedFor = (pathname: string) => {
  vi.mocked(usePathname).mockReturnValue(pathname)
  return useInvestmentFromUrl(INVESTMENTS)
}

describe('useInvestmentFromUrl', () => {
  beforeEach(() => vi.mocked(usePathname).mockReset())

  it.each([
    ['/inwestycje/1', '1'],
    ['/inwestycje/2/kosztorys', '2'],
  ])('seeds an investment the booking picker offers: %s', (pathname, seeded) => {
    expect(seedFor(pathname)).toBe(seeded)
  })

  it.each(['/inwestycje/3', '/inwestycje/4', '/inwestycje/5'])(
    'leaves the field empty for one it does not offer: %s',
    (pathname) => {
      expect(seedFor(pathname)).toBe('')
    },
  )

  it('reads only an /inwestycje path — a cash register id is not an investment id', () => {
    expect(seedFor('/kasa/1')).toBe('')
  })

  it('leaves the field empty for an id the user cannot pick', () => {
    expect(seedFor('/inwestycje/99')).toBe('')
  })
})
