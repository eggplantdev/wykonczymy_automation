import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryDialog } from '@/components/kosztorys/editor/history/history-dialog'
import type { HistoryEntryT } from '@/lib/kosztorys/history/types'

vi.mock('next/navigation', () => ({ usePathname: () => '/k/token' }))

const ENTRIES: HistoryEntryT[] = [
  { id: 9, label: null, day: '2026-03-02', summary: '2 różnice względem bieżącej' },
  {
    id: 7,
    label: 'Oferta wstępna',
    day: '2026-02-14',
    summary: '1 różnica względem bieżącej',
  },
  { id: 4, label: null, day: '2026-01-20', summary: 'Bez różnic względem bieżącej' },
]

function open(entries: HistoryEntryT[]) {
  render(<HistoryDialog entries={entries} open onOpenChange={() => {}} />)
  return screen.getByRole('dialog')
}

describe('HistoryDialog', () => {
  it('lists the entries in the order given, each linking to its version', () => {
    const dialog = open(ENTRIES)
    const links = within(dialog).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/k/token?wersja=9',
      '/k/token?wersja=7',
      '/k/token?wersja=4',
    ])
    expect(links[0]).toHaveTextContent('02.03.2026')
    expect(links[0]).toHaveTextContent('2 różnice względem bieżącej')
  })

  it('heads a named version with its label, the day beneath', () => {
    const dialog = open(ENTRIES)
    const named = within(dialog).getAllByRole('link')[1]
    expect(named.firstElementChild).toHaveTextContent('Oferta wstępna')
    expect(named).toHaveTextContent('14.02.2026')
  })

  it('says there is nothing to show when the list is empty', () => {
    const dialog = open([])
    expect(within(dialog).getByText('Brak zmian do pokazania')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
  })
})
