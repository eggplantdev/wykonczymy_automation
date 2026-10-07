import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  WorkerInvestmentsSection,
  type WorkerInvestmentLinkT,
} from '@/components/users/worker-investments-section'

const REPORT_URL = 'https://app.test/z/Mokotow/Jan/abc'
const INVESTMENTS: WorkerInvestmentLinkT[] = [
  { investmentId: 1, name: 'Mokotów', reportUrl: REPORT_URL },
  { investmentId: 2, name: 'Wola' },
]

const section = (canReport: boolean) => (
  <WorkerInvestmentsSection investments={INVESTMENTS} canReport={canReport} locale="pl" />
)

describe('WorkerInvestmentsSection investment links', () => {
  it('opens the report page on „Inwestycja” from the investment name on the worker’s own page', () => {
    render(section(true))

    expect(screen.getByRole('link', { name: 'Mokotów' })).toHaveAttribute(
      'href',
      `${REPORT_URL}?view=summary`,
    )
  })

  it('leaves an investment without a report link as plain text', () => {
    render(section(true))

    expect(screen.getByText('Wola')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Wola' })).not.toBeInTheDocument()
  })
})
