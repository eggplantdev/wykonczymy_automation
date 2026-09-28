import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoryDialog } from '@/components/kosztorys/editor/history/history-dialog'
import type { HistoryEntryT } from '@/lib/kosztorys/history/types'

vi.mock('next/navigation', () => ({ usePathname: () => '/k/token' }))

const ENTRIES: HistoryEntryT[] = [
  { id: 9, kind: 'daily', label: null, day: '2026-03-02', summary: 'Zmieniono 2 prace' },
  { id: 7, kind: 'named', label: 'Oferta wstępna', day: '2026-02-14', summary: 'Dodano 1 pracę' },
  { id: 4, kind: 'daily', label: null, day: '2026-01-20', summary: 'Rabat: brak → 500,00 zł' },
]

async function open(entries: HistoryEntryT[]) {
  render(<HistoryDialog entries={entries} />)
  await userEvent.click(screen.getByRole('button', { name: /Historia zmian/ }))
  return screen.getByRole('dialog')
}

describe('HistoryDialog', () => {
  it('lists the entries in the order given, each linking to its version', async () => {
    const dialog = await open(ENTRIES)
    const links = within(dialog).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/k/token?wersja=9',
      '/k/token?wersja=7',
      '/k/token?wersja=4',
    ])
    expect(links[0]).toHaveTextContent('02.03.2026')
    expect(links[0]).toHaveTextContent('Zmieniono 2 prace')
  })

  it('heads a named version with its label, the day beneath', async () => {
    const dialog = await open(ENTRIES)
    const named = within(dialog).getAllByRole('link')[1]
    expect(named.firstElementChild).toHaveTextContent('Oferta wstępna')
    expect(named).toHaveTextContent('14.02.2026')
  })

  it('says there is nothing to show when the list is empty', async () => {
    const dialog = await open([])
    expect(within(dialog).getByText('Brak zmian do pokazania')).toBeInTheDocument()
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument()
  })
})
