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
  // Before promotion nothing has travelled, so there is no split and nothing to send — the dialog
  // is a viewer with a delete, and the choosing happens in „Utwórz inwestycję".
  it('offers no transfer at all before the lead is promoted', async () => {
    const user = userEvent.setup()
    render(
      <LeadAssetsDialog
        lead={{ ...LEAD, investmentId: null, investmentName: null, investmentAssetIds: [] }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByText(/wybierasz przy jej tworzeniu/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Przenieś do inwestycji/ })).not.toBeInTheDocument()
  })

  it('splits the zgłoszenie’s files by what the inwestycja already holds', async () => {
    const user = userEvent.setup()
    render(<LeadAssetsDialog lead={LEAD} />)

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByText('Jeszcze nie w inwestycji (2)')).toBeInTheDocument()
    expect(screen.getByText('Już w inwestycji (1)')).toBeInTheDocument()
  })

  it('sends only the files that were not held back', async () => {
    const user = userEvent.setup()
    render(<LeadAssetsDialog lead={LEAD} />)

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))
    await user.click((await screen.findAllByLabelText('Nie przenoś tego pliku do inwestycji'))[0])
    await user.click(screen.getByRole('button', { name: 'Przenieś do inwestycji (1)' }))

    expect(attachLeadAssetsAction).toHaveBeenCalledWith(7, [13])
  })

  // Every file already across means nothing left to send — the submit would be a no-op button.
  it('drops the transfer section once nothing is left to send', async () => {
    const user = userEvent.setup()
    render(<LeadAssetsDialog lead={{ ...LEAD, investmentAssetIds: [11, 12, 13] }} />)

    await user.click(screen.getByRole('button', { name: 'Załączniki (3)' }))

    expect(await screen.findByText('Już w inwestycji (3)')).toBeInTheDocument()
    expect(screen.queryByText(/Jeszcze nie w inwestycji/)).not.toBeInTheDocument()
  })
})
