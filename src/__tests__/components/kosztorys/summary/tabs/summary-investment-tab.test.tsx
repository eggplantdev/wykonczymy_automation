import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SummaryInvestmentTab } from '@/components/kosztorys/summary/tabs/summary-investment-tab'
import type { InvestmentRefT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}))

// The gallery's actions are `'use server'`, and the harness swaps those for stubs that THROW when
// called. Nothing in this spec calls them, but the modules are imported eagerly.
vi.mock('@/lib/actions/investment-assets', () => ({
  addInvestmentAssetsAction: vi.fn(),
  removeInvestmentAssetAction: vi.fn(),
  removeAllInvestmentAssetsAction: vi.fn(),
}))

const PHOTO: MediaFileT = {
  id: 1,
  url: '/api/media/file/salon.jpg',
  filename: 'salon.jpg',
  mimeType: 'image/jpeg',
  thumbnailUrl: null,
  kind: null,
}

const INVESTMENT: InvestmentRefT = {
  id: 7,
  name: 'Dom pod lasem',
  status: 'active',
  address: 'ul. Wiosenna 4, Zielonka',
  phone: '500100200',
  email: 'kontakt@przyklad.test',
  contactPerson: 'Anna Kowalska',
  notes: 'Zakres prac: kuchnia, łazienka, salon — bez elewacji.',
  review: '',
  hasSheet: false,
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: 0.23,
}

describe('SummaryInvestmentTab', () => {
  it('shows the investment note alongside the contact fields', () => {
    render(<SummaryInvestmentTab investment={INVESTMENT} />)

    expect(screen.getByText(INVESTMENT.notes)).toBeInTheDocument()
    expect(screen.getByText(INVESTMENT.address)).toBeInTheDocument()
    expect(screen.getByText(INVESTMENT.contactPerson)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: INVESTMENT.phone })).toHaveAttribute(
      'href',
      `tel:${INVESTMENT.phone}`,
    )
    expect(screen.getByText('Aktywna')).toBeInTheDocument()
  })

  it('offers the edit dialog rather than editing in place', async () => {
    const user = userEvent.setup()
    render(<SummaryInvestmentTab investment={INVESTMENT} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edytuj inwestycję' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Radix portals the dialog outside the render container, so RTL's cleanup leaves it standing and
    // its `aria-hidden` swallows the next test's tree.
    await user.keyboard('{Escape}')
  })
})

describe('SummaryInvestmentTab — bramka galerii assetów', () => {
  it('counts the files the investment already carries', () => {
    render(<SummaryInvestmentTab investment={INVESTMENT} assets={[PHOTO]} />)

    expect(screen.getByRole('button', { name: 'Dokumentacja inwestycji (1)' })).toBeInTheDocument()
  })

  it('offers the picker with no counter when the investment has no files yet', () => {
    render(<SummaryInvestmentTab investment={INVESTMENT} assets={[]} />)

    expect(
      screen.getByRole('button', { name: 'Dokumentacja inwestycji (brak plików)' }),
    ).toBeInTheDocument()
  })

  // The szablon workbench and both share surfaces pass no `assets` at all. Rendering a gallery there
  // would expose the files of whichever investment the szablon was cut from.
  it('renders no gallery at all on a surface that carries none', () => {
    render(<SummaryInvestmentTab investment={INVESTMENT} />)

    expect(
      screen.queryByRole('button', { name: /^Dokumentacja inwestycji/ }),
    ).not.toBeInTheDocument()
  })
})
