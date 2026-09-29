import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrashContents } from '@/components/trash/trash-contents'
import type { TrashedInvestmentT } from '@/lib/queries/trash'

const row = (id: number, name: string, isTemplate: boolean): TrashedInvestmentT => ({
  id,
  name,
  trashedAt: new Date('2026-09-20T10:00:00Z'),
  isKosztorysUsed: false,
  isTemplate,
  daysLeft: 21,
})

const section = (title: string) =>
  screen.queryByRole('heading', { name: title })?.closest('section')

describe('TrashContents', () => {
  it('shows only „Inwestycje” when no szablon is in the trash', () => {
    render(<TrashContents rows={[row(1, 'Mieszkanie Kowalskich', false)]} />)

    expect(section('Inwestycje')).toBeInTheDocument()
    expect(section('Szablony')).toBeUndefined()
  })

  it('lists a szablon under „Szablony” and hides an empty „Inwestycje”', () => {
    render(<TrashContents rows={[row(2, 'Łazienka standard', true)]} />)

    expect(section('Inwestycje')).toBeUndefined()
    expect(within(section('Szablony') as HTMLElement).getByText('Łazienka standard')).toBeVisible()
  })

  it('says the trash is empty only when both kinds are', () => {
    const { rerender } = render(<TrashContents rows={[]} />)
    expect(screen.getByText('Kosz jest pusty')).toBeInTheDocument()

    rerender(<TrashContents rows={[row(2, 'Łazienka standard', true)]} />)
    expect(screen.queryByText('Kosz jest pusty')).not.toBeInTheDocument()
  })
})
