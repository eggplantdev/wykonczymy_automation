import { render, screen } from '@testing-library/react'
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
  executedNet: 4_500,
  payouts: [
    { date: '2026-09-01', amount: 2_000 },
    { date: '2026-09-15', amount: 1_000 },
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

describe('WorkerSummary', () => {
  it('reads the balance: przedmiar, per-etap executed, payouts and what is left', () => {
    render(<WorkerSummary summary={summary()} />)

    expect(valueBeside('Wartość przedmiaru (Twoja stawka)')).toContain('12000,00')
    expect(valueBeside('Etap 1')).toContain('3000,00')
    expect(valueBeside('Wykonane razem')).toContain('4500,00')
    expect(valueBeside('Wypłacone')).toContain('3000,00')
    expect(valueBeside('Pozostało do wypłaty')).toContain('1500,00')
  })

  it('shows a shared etap whole, with his share on a line of its own', () => {
    render(<WorkerSummary summary={summary()} />)

    expect(valueBeside('Etap 2 (cały etap)')).toContain('6000,00')
    expect(valueBeside('Twój udział: 25,0%')).toContain('1500,00')
  })

  // A payout's description is often an internal note (design #10) — the block has no slot for it.
  it('lists each payout by date and amount only', () => {
    render(<WorkerSummary summary={summary()} />)

    expect(valueBeside('01.09.2026')).toContain('2000,00')
    expect(valueBeside('15.09.2026')).toContain('1000,00')
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
