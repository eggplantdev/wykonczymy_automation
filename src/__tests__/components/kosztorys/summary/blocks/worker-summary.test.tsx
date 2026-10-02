import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { WorkerSummary } from '@/components/kosztorys/summary/blocks/worker-summary'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import { bare } from '@/__tests__/helpers/money'

const summary = (overrides: Partial<WorkerSummaryT> = {}): WorkerSummaryT => ({
  plannedNet: 12_000,
  executedByStage: [
    { stageId: 1, label: 'Etap 1', net: 3_000, wholeNet: 3_000, share: null },
    {
      stageId: 2,
      label: 'Etap 2',
      net: 1_500,
      wholeNet: 6_000,
      share: { percent: 25, amount: 1_500 },
    },
  ],
  stagesWholeNet: 9_000,
  executedNet: 4_500,
  payouts: [
    { date: '2026-09-01', amount: 2_000, description: 'ZUS lipiec' },
    { date: '2026-09-15', amount: 1_000, description: null },
  ],
  paidNet: 3_000,
  owed: 1_500,
  isOverpaid: false,
  ...overrides,
})

// The value cell sits right after its label cell among the grid's children (or a `contents` row's).
function valueBeside(label: string): string {
  let cell: HTMLElement = screen.getByText(label)
  while (cell.parentElement && !cell.parentElement.matches('div.grid, div.contents')) {
    cell = cell.parentElement
  }
  return bare(cell.nextElementSibling?.textContent ?? '')
}

const text = (cell: Element) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()

// One row of a table: an etap or payout row is a `contents` wrapper; a „Razem" row is the label cell
// and the cells after it, up to the grid's width.
function rowCells(label: HTMLElement, width: number): string[] {
  const wrapper = label.closest('div.contents')
  if (wrapper) return [...wrapper.children].map(text)
  let cell = label
  while (cell.parentElement && !cell.parentElement.matches('div.grid')) cell = cell.parentElement
  const siblings = [...(cell.parentElement?.children ?? [])]
  const at = siblings.indexOf(cell)
  return siblings.slice(at, at + width).map(text)
}

const tableOf = (header: string) => screen.getByText(header).closest('div.grid') as HTMLElement

describe('WorkerSummary', () => {
  it('reads the balance: per-etap executed, payouts and what is left — never the przedmiar', () => {
    render(<WorkerSummary summary={summary()} />)

    expect(screen.queryByText(/Wartość przedmiaru/)).toBeNull()

    expect(valueBeside('Wykonane razem')).toContain('4500,00')
    expect(valueBeside('Wypłacone')).toContain('3000,00')
    expect(valueBeside('Pozostało do wypłaty')).toContain('1500,00')
  })

  it('lays each etap out as the whole etap, his share and his amount, both columns totalled', () => {
    render(<WorkerSummary summary={summary()} />)
    const executed = tableOf('Wykonane')

    expect(rowCells(within(executed).getByText('Etap 1'), 4)).toEqual([
      'Etap 1',
      '3000,00',
      '100,0%',
      '3000,00',
    ])
    expect(rowCells(within(executed).getByText('Etap 2'), 4)).toEqual([
      'Etap 2',
      '6000,00',
      '25,0%',
      '1500,00',
    ])
    expect(rowCells(within(executed).getByText('Razem'), 4)).toEqual([
      'Razem',
      '9000,00',
      '',
      '4500,00',
    ])
  })

  it('drops the whole-etap and share columns when nobody shares his etapy', () => {
    const [own] = summary().executedByStage
    render(
      <WorkerSummary
        summary={summary({ executedByStage: [own], stagesWholeNet: 3_000, executedNet: 3_000 })}
      />,
    )
    const executed = tableOf('Wykonane')

    expect(within(executed).queryByText('Wartość etapu')).toBeNull()
    expect(within(executed).queryByText('Twój udział')).toBeNull()
    expect(rowCells(within(executed).getByText('Razem'), 2)).toEqual(['Razem', '3000,00'])
  })

  it('reads the etapy first, then the balance, then the payouts', () => {
    render(<WorkerSummary summary={summary()} />)
    const [executed, balance, payouts] = ['Wykonane', 'Twoje rozliczenie', 'Wypłaty'].map(tableOf)

    expect(executed.compareDocumentPosition(balance)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(balance.compareDocumentPosition(payouts)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('lists the payouts in a table of their own, by date, description and amount', () => {
    render(<WorkerSummary summary={summary()} />)

    const payouts = tableOf('Wypłaty')

    expect(rowCells(within(payouts).getByText('ZUS lipiec'), 3)).toEqual([
      '01.09.2026',
      'ZUS lipiec',
      '2000,00',
    ])
    expect(rowCells(within(payouts).getByText('15.09.2026'), 3)).toEqual([
      '15.09.2026',
      '',
      '1000,00',
    ])
    expect(rowCells(within(payouts).getByText('Razem'), 2)).toEqual(['Razem', '3000,00'])
    expect(payouts).not.toBe(tableOf('Twoje rozliczenie'))
  })

  it('leaves the payouts table out when nothing was paid', () => {
    render(<WorkerSummary summary={summary({ payouts: [], paidNet: 0, owed: 4_500 })} />)

    expect(screen.queryByText('Wypłaty')).toBeNull()
  })

  it('names an overpayment instead of printing a negative remainder', () => {
    render(<WorkerSummary summary={summary({ paidNet: 5_000, owed: -500, isOverpaid: true })} />)

    expect(screen.queryByText('Pozostało do wypłaty')).toBeNull()
    expect(valueBeside('Nadpłata')).toMatch(/^500,00/)
    expect(valueBeside('Nadpłata')).not.toContain('-')
  })

  it('reads zero once everything is paid', () => {
    render(<WorkerSummary summary={summary({ paidNet: 4_500, owed: 0 })} />)

    expect(valueBeside('Pozostało do wypłaty')).toMatch(/^0,00/)
  })
})
