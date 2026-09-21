import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PromoteLeadDialog } from '@/components/leads/promote-lead-dialog'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { LeadRowT } from '@/types/leads'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/zgloszenia',
}))
vi.mock('@/lib/actions/promote-lead', () => ({
  promoteLeadAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const LEAD: LeadRowT = {
  id: 7,
  source: 'landing_form',
  name: 'Anna Kowalska',
  email: 'anna@example.com',
  phone: '500600700',
  address: 'ul. Kwiatowa 5, Warszawa',
  scope: 'Łazienka pod klucz',
  area: '12 m²',
  formName: 'Wycena',
  submittedAt: '2026-09-18T10:00:00.000Z',
  contactStatus: 'new',
  answers: [{ label: 'Wiadomość', value: 'Proszę o kontakt po 16.' }],
  assets: [],
  investmentId: null,
}

beforeEach(() => {
  useOptimisticFormStore.getState().closeDialog()
})

describe('PromoteLeadDialog', () => {
  it('prefills the investment form from the zgłoszenie', async () => {
    const user = userEvent.setup()
    render(<PromoteLeadDialog lead={LEAD} />)

    await user.click(screen.getByRole('button', { name: 'Utwórz inwestycję' }))

    expect(await screen.findByLabelText('Nazwa')).toHaveValue(LEAD.name)
    expect(screen.getByLabelText('Adres')).toHaveValue(LEAD.address)
    expect(screen.getByLabelText('Telefon')).toHaveValue(LEAD.phone)
    expect(screen.getByLabelText('Email')).toHaveValue(LEAD.email)
    expect(screen.getByLabelText('Osoba kontaktowa')).toHaveValue(LEAD.name)
    // The three answers an inwestycja has no column for, kept rather than dropped.
    expect(screen.getByLabelText('Notatki')).toHaveValue(
      'Zakres prac: Łazienka pod klucz\nMetraż: 12 m²\nWiadomość: Proszę o kontakt po 16.',
    )
  })

  it('offers a link instead of a form once the lead has an investment', () => {
    render(<PromoteLeadDialog lead={{ ...LEAD, investmentId: 42 }} />)

    expect(screen.getByRole('link', { name: /Inwestycja/ })).toHaveAttribute(
      'href',
      '/inwestycje/42',
    )
    expect(screen.queryByRole('button', { name: 'Utwórz inwestycję' })).not.toBeInTheDocument()
  })
})
