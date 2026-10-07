import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportWorkButton, type ReportTargetT } from '@/components/users/report-work-button'

const MOKOTOW: ReportTargetT = {
  investmentId: 1,
  name: 'Mokotów',
  reportUrl: 'https://app.test/z/Mokotow/Jan/a',
}
const WOLA: ReportTargetT = {
  investmentId: 2,
  name: 'Wola',
  reportUrl: 'https://app.test/z/Wola/Jan/b',
}

const button = (targets: ReportTargetT[]) => (
  <ReportWorkButton targets={targets} label="Zgłoś pracę" pickerTitle="Na której inwestycji?" />
)

describe('ReportWorkButton', () => {
  it('links straight to the report when the worker has one investment', () => {
    render(button([MOKOTOW]))

    expect(screen.getByRole('link', { name: 'Zgłoś pracę' })).toHaveAttribute(
      'href',
      MOKOTOW.reportUrl,
    )
  })

  it('asks which investment when the worker has several', async () => {
    render(button([MOKOTOW, WOLA]))

    await userEvent.click(screen.getByRole('button', { name: 'Zgłoś pracę' }))

    expect(screen.getByRole('dialog', { name: 'Na której inwestycji?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mokotów' })).toHaveAttribute('href', MOKOTOW.reportUrl)
    expect(screen.getByRole('link', { name: 'Wola' })).toHaveAttribute('href', WOLA.reportUrl)
  })
})
