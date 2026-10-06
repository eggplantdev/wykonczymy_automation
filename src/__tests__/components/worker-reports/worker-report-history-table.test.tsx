import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WorkerReportHistoryTable } from '@/components/worker-reports/worker-report-history-table'
import type { ReportListRowT } from '@/lib/db/worker-reports'

const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/pracownicy/2',
  useRouter: () => ({ refresh: vi.fn(), replace, push, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const report = (id: number, overrides: Partial<ReportListRowT> = {}): ReportListRowT => ({
  id,
  investmentId: 3,
  investmentName: `Inwestycja ${id}`,
  workerName: 'Jan',
  status: 'pending',
  source: 'link',
  sentAt: '2026-10-06T10:00:00Z',
  decidedAt: null,
  decidedByName: null,
  lineCount: 2,
  acceptedLineCount: 0,
  ...overrides,
})

const reports = Array.from({ length: 25 }, (_, i) => report(i + 1))
const shownIds = () =>
  screen.queryAllByText(/^Inwestycja \d+$/).map((el) => Number(el.textContent?.split(' ')[1]))

function renderTable(rows: ReportListRowT[], canOpenInKosztorys = false) {
  return render(<WorkerReportHistoryTable reports={rows} canOpenInKosztorys={canOpenInKosztorys} />)
}

describe('WorkerReportHistoryTable', () => {
  it('pages 25 reports as 10, 10 and 5 without touching the URL', async () => {
    const user = userEvent.setup()
    renderTable(reports)
    expect(shownIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    await user.click(screen.getByRole('button', { name: /2$/ }))
    expect(shownIds()).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])

    await user.click(screen.getByRole('button', { name: /3$/ }))
    expect(shownIds()).toEqual([21, 22, 23, 24, 25])
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('narrows to the ticked status, back on page 1, without touching the URL', async () => {
    const user = userEvent.setup()
    renderTable([
      ...reports,
      report(26, { status: 'rejected', decidedAt: '2026-10-06T12:00:00Z' }),
      report(27, { status: 'rejected', decidedAt: '2026-10-06T12:00:00Z' }),
    ])
    await user.click(screen.getByRole('button', { name: /3$/ }))

    await user.click(screen.getByRole('button', { name: /^Status/ }))
    const toggleAll = () => screen.getByRole('option', { name: /^(Zaznacz|Odznacz) wszystkie$/ })
    if (toggleAll().textContent?.includes('Zaznacz')) await user.click(toggleAll())
    await user.click(toggleAll())
    await user.click(screen.getByRole('option', { name: 'Odrzucone' }))
    await user.keyboard('{Escape}')

    expect(shownIds()).toEqual([26, 27])
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('gives the worker „Podgląd” alone', () => {
    renderTable([report(1)])

    expect(screen.getByRole('button', { name: 'Podgląd' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Otwórz w kosztorysie' })).not.toBeInTheDocument()
  })

  it('gives a manager on the worker page „Podgląd” and „Otwórz w kosztorysie”', () => {
    renderTable([report(1)], true)

    expect(screen.getByRole('button', { name: 'Podgląd' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Otwórz w kosztorysie' })).toBeInTheDocument()
  })
})
