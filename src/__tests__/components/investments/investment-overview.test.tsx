import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvestmentOverview } from '@/components/investments/investment-overview'
import { NO_INVESTMENT_DETAILS } from '@/lib/investments/investment-details'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { useCurrentUser as currentUserStub } from '@/__tests__/stubs/use-current-user'
import {
  useOrderSettings as orderSettingsStub,
  useReferenceData as referenceDataStub,
} from '@/__tests__/stubs/use-reference-data'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useOrderSettings, useReferenceData } from '@/hooks/use-reference-data'

vi.mocked(useCurrentUser).mockImplementation(currentUserStub)
vi.mocked(useReferenceData).mockImplementation(referenceDataStub)
vi.mocked(useOrderSettings).mockImplementation(orderSettingsStub)

const INVESTMENT: InvestmentWithDetailsT = {
  ...NO_INVESTMENT_DETAILS,
  id: 7,
  name: 'Dom pod lasem',
  status: 'active',
  address: 'ul. Wiosenna 4, Zielonka',
  phone: '500100200',
  email: 'kontakt@przyklad.test',
  contactPerson: 'Anna Kowalska',
  notes: 'Zakres prac: kuchnia, łazienka, salon.',
  reviewRequested: false,
  hasSheet: false,
  aiStage: null,
  aiNotes: '',
  createdAt: '2026-01-15T10:00:00.000Z',
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: 0.23,
}

describe('InvestmentOverview', () => {
  beforeEach(() => {
    authState.role = 'OWNER'
  })

  it('offers every action on a live investment', () => {
    render(<InvestmentOverview investment={INVESTMENT} trashed={false} assets={[]} showKosztorysButton />)

    expect(screen.getByRole('button', { name: 'Edytuj inwestycję' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Umowa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kontener' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kosztorys v2' })).toBeInTheDocument()
    expect(screen.getByText('Kierownik budowy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edytuj notatkę' })).toBeInTheDocument()
  })

  it('is read-only for an investment in the Kosz', () => {
    render(<InvestmentOverview investment={INVESTMENT} trashed assets={[]} />)

    expect(screen.getByRole('status')).toHaveTextContent('Inwestycja jest w koszu')
    for (const name of ['Edytuj inwestycję', 'Umowa', 'Kontener', 'Edytuj notatkę']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByText('Kierownik budowy')).not.toBeInTheDocument()
  })

  it('leaves the Kosztorys v2 button to the investment page', () => {
    render(<InvestmentOverview investment={INVESTMENT} trashed={false} assets={[]} />)

    expect(screen.queryByRole('link', { name: 'Kosztorys v2' })).not.toBeInTheDocument()
  })

  it('renders without the order and Kierownik data when the session carries none', () => {
    authState.role = 'EMPLOYEE'
    render(<InvestmentOverview investment={INVESTMENT} trashed={false} assets={[]} />)

    expect(screen.getByText(INVESTMENT.address)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kontener' })).not.toBeInTheDocument()
    expect(screen.queryByText('Kierownik budowy')).not.toBeInTheDocument()
  })
})
