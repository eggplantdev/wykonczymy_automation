import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LeadAssetsDialog } from '@/components/leads/lead-assets-dialog'
import { attachLeadAssetsAction } from '@/lib/actions/lead-assets'
import type { LeadRowT } from '@/types/leads'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => '/zgloszenia',
}))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/lead-assets', () => ({
  attachLeadAssetsAction: vi.fn(async () => ({ success: true })),
  removeLeadAssetAction: vi.fn(async () => ({ success: true })),
}))
vi.mock('@/lib/actions/investment-assets', () => ({
  investmentAssetIdsAction: vi.fn(async () => ({ success: true, data: [] })),
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
  {
    id: 13,
    url: '/c.jpg',
    filename: 'taras.jpg',
    mimeType: 'image/jpeg',
    thumbnailUrl: '/c-t.jpg',
  },
]

const INVESTMENTS = [
  { id: 42, name: 'Kowalska Kwiatowa 5' },
  { id: 43, name: 'Nowak Polna 2' },
]

const LEAD: LeadRowT = {
  id: 7,
  source: 'landing_form',
  name: 'Anna Kowalska',
  email: 'anna@example.com',
  phone: '500600700',
  address: 'ul. Kwiatowa 5',
  scope: '',
  area: '',
  formName: 'Wycena',
  submittedAt: null,
  contactStatus: 'contacted',
  answers: [],
  assets: ASSETS,
  investmentId: 42,
  investmentName: 'Kowalska Kwiatowa 5',
  investmentAssetIds: [11],
}

describe('LeadAssetsDialog', () => {
  // A zgłoszenie nobody promoted still has files worth filing somewhere — it just has no target
  // picked yet, so the transfer waits on the select rather than being hidden.
  it('offers the transfer without a target, but refuses to send until one is picked', async () => {
    const user = userEvent.setup()
    render(
      <LeadAssetsDialog
        lead={{ ...LEAD, investmentId: null, investmentName: null, investmentAssetIds: [] }}
        investments={INVESTMENTS}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Przenieś do inwestycji (3)' })).toBeDisabled()
    expect(screen.queryByText(/Już w inwestycji/)).not.toBeInTheDocument()
  })

  it('splits the zgłoszenie’s files by what the inwestycja already holds', async () => {
    const user = userEvent.setup()
    render(<LeadAssetsDialog lead={LEAD} investments={INVESTMENTS} />)

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByText('Jeszcze nie w inwestycji (2)')).toBeInTheDocument()
    expect(screen.getByText('Już w inwestycji (1)')).toBeInTheDocument()
  })

  // The zgłoszenie's own inwestycja is the target the select starts on, so the common case is one
  // click — and the id travels with the batch rather than being re-derived server-side.
  it('sends only the files that were not held back, to the preselected inwestycja', async () => {
    const user = userEvent.setup()
    render(<LeadAssetsDialog lead={LEAD} investments={INVESTMENTS} />)

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))
    await user.click((await screen.findAllByLabelText('Nie przenoś tego pliku do inwestycji'))[0])
    await user.click(screen.getByRole('button', { name: 'Przenieś do inwestycji (1)' }))

    expect(attachLeadAssetsAction).toHaveBeenCalledWith(7, 42, [13])
  })

  // Every file already across means nothing left to send — the submit would be a no-op button.
  it('drops the transfer section once nothing is left to send', async () => {
    const user = userEvent.setup()
    render(
      <LeadAssetsDialog
        lead={{ ...LEAD, investmentAssetIds: [11, 12, 13] }}
        investments={INVESTMENTS}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByText('Już w inwestycji (3)')).toBeInTheDocument()
    expect(screen.queryByText(/Jeszcze nie w inwestycji/)).not.toBeInTheDocument()
  })
})
