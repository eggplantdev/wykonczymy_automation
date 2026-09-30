import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TrashContents } from '@/components/trash/trash-contents'
import type { TrashKindT, TrashRowT } from '@/types/trash'

const row = (id: number, name: string, kind: TrashKindT): TrashRowT => ({
  kind,
  id,
  name,
  trashedAt: new Date('2026-09-20T10:00:00Z'),
  daysLeft: 21,
  autoPurges: true,
  mustTypeName: kind === 'template',
})

const section = (title: string) =>
  screen.queryByRole('heading', { name: title })?.closest('section')

describe('TrashContents', () => {
  it('shows only „Inwestycje” when no szablon or kasa is in the trash', () => {
    render(<TrashContents rows={[row(1, 'Mieszkanie Kowalskich', 'investment')]} />)

    expect(section('Inwestycje')).toBeInTheDocument()
    expect(section('Szablony')).toBeUndefined()
    expect(section('Kasy')).toBeUndefined()
  })

  it('lists a szablon under „Szablony” and hides an empty „Inwestycje”', () => {
    render(<TrashContents rows={[row(2, 'Łazienka standard', 'template')]} />)

    expect(section('Inwestycje')).toBeUndefined()
    expect(within(section('Szablony') as HTMLElement).getByText('Łazienka standard')).toBeVisible()
  })

  it('lists a kasa under „Kasy”, apart from the investments', () => {
    render(
      <TrashContents
        rows={[
          row(1, 'Mieszkanie Kowalskich', 'investment'),
          row(3, 'Kasa Adriana', 'cash-register'),
        ]}
      />,
    )

    const kasy = section('Kasy') as HTMLElement
    expect(within(kasy).getByText('Kasa Adriana')).toBeVisible()
    expect(within(kasy).queryByText('Mieszkanie Kowalskich')).not.toBeInTheDocument()
  })

  it('says the trash is empty only when every kind is', () => {
    const { rerender } = render(<TrashContents rows={[]} />)
    expect(screen.getByText('Kosz jest pusty')).toBeInTheDocument()

    rerender(<TrashContents rows={[row(3, 'Kasa Adriana', 'cash-register')]} />)
    expect(screen.queryByText('Kosz jest pusty')).not.toBeInTheDocument()
  })
})
