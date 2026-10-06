import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TranslationsProvider } from '@/components/kosztorys/worker-report/translations-provider'
import { WorkerSummary } from '@/components/kosztorys/worker-report/worker-summary'
import { uk } from '@/lib/i18n/dictionaries/uk'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import { bare } from '@/__tests__/helpers/money'

const summary = (overrides: Partial<WorkerSummaryT> = {}): WorkerSummaryT => ({
  plannedNet: 12_000,
  executedByStage: [
    { stageId: 1, label: 'Etap 1', ordinal: 1, net: 3_000, wholeNet: 3_000, share: null },
    {
      stageId: 2,
      label: null,
      ordinal: 2,
      net: 1_500,
      wholeNet: 6_000,
      share: { percent: 25, amount: 1_500 },
    },
  ],
  stagesWholeNet: 9_000,
  executedNet: 4_500,
  bonusNet: 0,
  payouts: [
    { date: '2026-09-01', amount: 2_000, description: 'ZUS lipiec' },
    { date: '2026-09-15', amount: 1_000, description: null },
  ],
  paidNet: 3_000,
  owed: 1_500,
  isOverpaid: false,
  ...overrides,
})

const cellOf = (label: string) => screen.getByText(label).closest('td') as HTMLElement

function valueBeside(label: string): string {
  return bare(cellOf(label).nextElementSibling?.textContent ?? '')
}

const text = (cell: Element) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()

const rowCells = (label: HTMLElement) => [...(label.closest('tr')?.children ?? [])].map(text)

const tableOf = (header: string) => screen.getByText(header).closest('table') as HTMLElement

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

    expect(rowCells(within(executed).getByText('Etap 1'))).toEqual([
      'Etap 1',
      '3000,00',
      '100,0%',
      '3000,00',
    ])
    expect(rowCells(within(executed).getByText('Etap 2'))).toEqual([
      'Etap 2',
      '6000,00',
      '25,0%',
      '1500,00',
    ])
    expect(rowCells(within(executed).getByText('Razem'))).toEqual([
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
    expect(rowCells(within(executed).getByText('Razem'))).toEqual(['Razem', '3000,00'])
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

    expect(rowCells(within(payouts).getByText('ZUS lipiec'))).toEqual([
      '01.09.2026',
      'ZUS lipiec',
      '2000,00',
    ])
    expect(rowCells(within(payouts).getByText('15.09.2026'))).toEqual(['15.09.2026', '', '1000,00'])
    expect(rowCells(within(payouts).getByText('Razem'))).toEqual(['Razem', '3000,00'])
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

  it('shows the premia as its own line, and no such line without one', () => {
    const { unmount } = render(
      <WorkerSummary summary={summary({ bonusNet: 205.01, owed: 1_705.01 })} />,
    )
    expect(valueBeside('Premia')).toMatch(/^205,01/)
    unmount()

    render(<WorkerSummary summary={summary()} />)
    expect(screen.queryByText('Premia')).toBeNull()
  })

  it('reads zero once everything is paid', () => {
    render(<WorkerSummary summary={summary({ paidNet: 4_500, owed: 0 })} />)

    expect(valueBeside('Pozostało do wypłaty')).toMatch(/^0,00/)
  })

  it('speaks the worker’s language', () => {
    render(
      <TranslationsProvider initialLocale="uk" workerId={1}>
        <WorkerSummary summary={summary()} />
      </TranslationsProvider>,
    )

    expect(screen.getByText(uk.report.summaryBalance)).toBeInTheDocument()
    expect(screen.getByText('Етап 2')).toBeInTheDocument()
    expect(valueBeside(uk.report.summaryOwed)).toContain('1500,00')
    expect(screen.queryByText('Twoje rozliczenie')).toBeNull()
  })
})
