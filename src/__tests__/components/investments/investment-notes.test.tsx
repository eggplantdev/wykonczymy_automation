import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvestmentNotes } from '@/components/investments/investment-notes'
import { updateInvestmentAction } from '@/lib/actions/investments'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentRefT } from '@/types/reference-data'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/lib/actions/investments', () => ({ updateInvestmentAction: vi.fn() }))

const INVESTMENT: InvestmentRefT = {
  id: 7,
  name: 'Dom pod lasem',
  status: 'active',
  address: 'ul. Wiosenna 4, Zielonka',
  phone: '500100200',
  email: 'kontakt@przyklad.test',
  contactPerson: 'Anna Kowalska',
  notes: 'Zakres prac: kuchnia, łazienka',
  reviewRequested: true,
  hasSheet: false,
  createdAt: '2026-01-15T10:00:00.000Z',
  materialsNetRate: null,
  settlementMode: 'NET',
  vatRate: 0.23,
}

const NEW_NOTE = 'Doszła elewacja od strony ogrodu.'

beforeEach(() => {
  vi.mocked(updateInvestmentAction).mockReset()
  vi.mocked(toastMessage).mockReset()
})

async function editNote(text: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Edytuj notatkę' }))
  const field = screen.getByRole('textbox', { name: 'Notatki' })
  await user.clear(field)
  await user.type(field, text)
  return user
}

describe('InvestmentNotes', () => {
  it('shows a dash for an empty note', () => {
    render(<InvestmentNotes investment={{ ...INVESTMENT, notes: '' }} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  // The action writes the whole record: anything but the note sent differently from the server copy
  // would silently change another field on a note save.
  it('saves the edited note with the rest of the record unchanged', async () => {
    vi.mocked(updateInvestmentAction).mockResolvedValue({ success: true })
    render(<InvestmentNotes investment={INVESTMENT} />)

    const user = await editNote(NEW_NOTE)
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(updateInvestmentAction).toHaveBeenCalledWith(INVESTMENT.id, {
      name: INVESTMENT.name,
      address: INVESTMENT.address,
      phone: INVESTMENT.phone,
      email: INVESTMENT.email,
      contactPerson: INVESTMENT.contactPerson,
      notes: NEW_NOTE,
      reviewRequested: INVESTMENT.reviewRequested,
      status: INVESTMENT.status,
      presetId: '',
    })
    expect(toastMessage).toHaveBeenCalledWith('Notatka zapisana', 'success')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('discards the edit on „Anuluj” without saving', async () => {
    render(<InvestmentNotes investment={INVESTMENT} />)

    const user = await editNote(NEW_NOTE)
    await user.click(screen.getByRole('button', { name: 'Anuluj' }))

    expect(updateInvestmentAction).not.toHaveBeenCalled()
    expect(screen.getByText(INVESTMENT.notes)).toBeInTheDocument()
  })

  it('keeps the typed note open for another try when the save fails', async () => {
    vi.mocked(updateInvestmentAction).mockResolvedValue({ success: false, error: 'Błąd zapisu' })
    render(<InvestmentNotes investment={INVESTMENT} />)

    const user = await editNote(NEW_NOTE)
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(toastMessage).toHaveBeenCalledWith('Błąd zapisu', 'error')
    expect(screen.getByRole('textbox', { name: 'Notatki' })).toHaveValue(NEW_NOTE)
  })

  it('offers no edit on a read-only investment', () => {
    render(<InvestmentNotes investment={INVESTMENT} readOnly />)

    expect(screen.getByText(INVESTMENT.notes)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edytuj notatkę' })).not.toBeInTheDocument()
  })
})
