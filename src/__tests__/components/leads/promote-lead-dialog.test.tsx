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
vi.mock('@/lib/actions/lead-assets', () => ({
  attachLeadAssetsAction: vi.fn(async () => ({ success: true })),
  removeLeadAssetAction: vi.fn(async () => ({ success: true })),
}))

const ASSETS = [
  {
    id: 11,
    url: '/a.jpg',
    filename: 'kuchnia.jpg',
    mimeType: 'image/jpeg',
    thumbnailUrl: '/a-t.jpg',
  },
  {
    id: 12,
    url: '/b.jpg',
    filename: 'salon.jpg',
    mimeType: 'image/jpeg',
    thumbnailUrl: '/b-t.jpg',
  },
]

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
  investmentAssetIds: [],
}

beforeEach(() => {
  useOptimisticFormStore.getState().closeDialog()
})

describe('PromoteLeadDialog', () => {
  it('prefills the investment form from the zgłoszenie', async () => {
    const user = userEvent.setup()
    render(<PromoteLeadDialog lead={LEAD} />)

    await user.click(screen.getByRole('button', { name: 'Utwórz inwestycję' }))

    expect(await screen.findByLabelText('Nazwa')).toHaveValue(`${LEAD.name} ${LEAD.address}`)
    expect(screen.getByLabelText('Adres')).toHaveValue(LEAD.address)
    expect(screen.getByLabelText('Telefon')).toHaveValue(LEAD.phone)
    expect(screen.getByLabelText('Email')).toHaveValue(LEAD.email)
    expect(screen.getByLabelText('Osoba kontaktowa')).toHaveValue(LEAD.name)
    // The three answers an inwestycja has no column for, kept rather than dropped.
    expect(screen.getByLabelText('Notatki')).toHaveValue(
      'Zakres prac: Łazienka pod klucz\nMetraż: 12 m²\nWiadomość: Proszę o kontakt po 16.',
    )
  })

  // A Facebook lead carries no address, and a name ending in a stray space is what the staff
  // member then has to delete by hand on every single promotion.
  it('falls back to the name alone when the zgłoszenie has no address', async () => {
    const user = userEvent.setup()
    render(<PromoteLeadDialog lead={{ ...LEAD, address: '' }} />)

    await user.click(screen.getByRole('button', { name: 'Utwórz inwestycję' }))

    expect(await screen.findByLabelText('Nazwa')).toHaveValue(LEAD.name)
  })

  // „Aktywna" would file an enquiry nobody has agreed to among the jobs actually running.
  it('opens on „Planowana" rather than „Aktywna"', async () => {
    const user = userEvent.setup()
    render(<PromoteLeadDialog lead={LEAD} />)

    await user.click(screen.getByRole('button', { name: 'Utwórz inwestycję' }))

    expect(await screen.findByLabelText('Status')).toHaveTextContent('Planowana')
  })

  it('lets a file be held back from the inwestycja without deleting it', async () => {
    const user = userEvent.setup()
    render(<PromoteLeadDialog lead={{ ...LEAD, assets: ASSETS }} />)

    await user.click(screen.getByRole('button', { name: 'Utwórz inwestycję' }))
    expect(await screen.findByText('Przejdą do inwestycji: 2 z 2')).toBeInTheDocument()

    await user.click(screen.getAllByLabelText('Nie przenoś tego pliku do inwestycji')[0])

    expect(screen.getByText('Przejdą do inwestycji: 1 z 2')).toBeInTheDocument()
    // Held back, still on the zgłoszenie — the tile does not disappear.
    expect(screen.getByLabelText('Przywróć ten plik do inwestycji')).toBeInTheDocument()
  })

  it('offers a link instead of a form once the lead has an investment', () => {
    render(<PromoteLeadDialog lead={{ ...LEAD, investmentId: 42 }} />)

    expect(screen.getByRole('link', { name: /Inwestycja/ })).toHaveAttribute(
      'href',
      '/inwestycje/42',
    )
    expect(screen.queryByRole('button', { name: 'Utwórz inwestycję' })).not.toBeInTheDocument()
  })

  // The promotion is not the last chance: the zgłoszenie keeps its files, so whatever was held
  // back has to stay reachable from the row afterwards.
  it('still offers the files of a promoted lead', () => {
    render(<PromoteLeadDialog lead={{ ...LEAD, investmentId: 42, assets: ASSETS }} />)

    expect(screen.getByRole('button', { name: 'Pliki (2)' })).toBeInTheDocument()
  })
})
