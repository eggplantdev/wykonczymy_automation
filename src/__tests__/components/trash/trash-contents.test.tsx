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
  hasSheet: false,
  autoPurges: true,
  pairedRegisters: [],
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

  it('opens a trashed investment and its kosztorysy without restoring it, a kasa not at all', () => {
    render(
      <TrashContents
        rows={[
          { ...row(1, 'Mieszkanie Kowalskich', 'investment'), hasSheet: true },
          row(4, 'Dom Nowaków', 'investment'),
          row(3, 'Kasa Adriana', 'cash-register'),
        ]}
      />,
    )

    const hrefs = (text: string) =>
      within(screen.getByText(text).closest('li') as HTMLElement)
        .queryAllByRole('link')
        .map((link) => link.getAttribute('href'))

    expect(hrefs('Mieszkanie Kowalskich')).toEqual([
      '/inwestycje/1',
      '/inwestycje/1/kosztorys',
      '/inwestycje/1/kosztorys_v2',
    ])
    expect(hrefs('Dom Nowaków')).toEqual(['/inwestycje/4', '/inwestycje/4/kosztorys_v2'])
    expect(hrefs('Kasa Adriana')).toEqual([])
  })

  it('lists a worker under „Pracownicy” with the kasy that went with him', () => {
    render(
      <TrashContents
        rows={[
          { ...row(5, 'Jan Kowalski', 'worker'), pairedRegisters: ['Kasa Jana', 'Kasa budowy'] },
        ]}
      />,
    )

    const workers = section('Pracownicy') as HTMLElement
    expect(within(workers).getByText('Jan Kowalski')).toBeVisible()
    expect(within(workers).getByText('razem z kasami: Kasa Jana, Kasa budowy')).toBeVisible()
  })

  it('lists cars under „Flota” and items under „Sprzęt”, after „Pracownicy”, with the detail line', () => {
    render(
      <TrashContents
        rows={[
          { ...row(7, 'Szlifierka', 'equipment'), detail: 'Makita GA5030 · nr ser. SN-1' },
          { ...row(6, 'WX 1000A', 'vehicle'), detail: 'Ford Transit' },
          row(5, 'Jan Kowalski', 'worker'),
        ]}
      />,
    )

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Pracownicy', 'Flota', 'Sprzęt'])
    expect(within(section('Flota') as HTMLElement).getByText('Ford Transit')).toBeVisible()
    expect(
      within(section('Sprzęt') as HTMLElement).getByText('Makita GA5030 · nr ser. SN-1'),
    ).toBeVisible()
  })

  it('says the trash is empty only when every kind is', () => {
    const { rerender } = render(<TrashContents rows={[]} />)
    expect(screen.getByText('Kosz jest pusty')).toBeInTheDocument()

    rerender(<TrashContents rows={[row(3, 'Kasa Adriana', 'cash-register')]} />)
    expect(screen.queryByText('Kosz jest pusty')).not.toBeInTheDocument()
  })
})
